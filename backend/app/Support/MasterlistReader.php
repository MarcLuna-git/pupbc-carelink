<?php

namespace App\Support;

use RuntimeException;
use ZipArchive;

/*
 * Reads the first sheet of an .xlsx file, or a .csv file, into plain rows of text.
 * Each row is [line number, [cell text, ...]] with cells in column order (A = 0).
 * No spreadsheet library is needed: an .xlsx file is a zip of XML parts.
 */
class MasterlistReader
{
    public const MAX_ROWS = 10000;
    private const MAX_PART_BYTES = 60 * 1024 * 1024; // guards against zip bombs

    /** @return array<int, array{0: int, 1: array<int, string>}> */
    public static function read(string $path, string $extension): array
    {
        $extension = strtolower($extension);
        if ($extension === 'xlsx') return self::readXlsx($path);
        if ($extension === 'csv' || $extension === 'txt') return self::readCsv($path);
        throw new RuntimeException('Use an Excel (.xlsx) or CSV (.csv) file.');
    }

    private static function readXlsx(string $path): array
    {
        if (!class_exists(ZipArchive::class)) throw new RuntimeException('This server cannot open Excel files. Save the file as CSV and try again.');
        $zip = new ZipArchive();
        if ($zip->open($path) !== true) throw new RuntimeException('We could not open this Excel file. Save it again as .xlsx and try again.');

        try {
            $sheetPath = self::firstSheetPath($zip);
            $shared = self::sharedStrings($zip);
            $stat = $zip->statName($sheetPath);
            if (!$stat) throw new RuntimeException('We could not find a sheet in this Excel file.');
            if ($stat['size'] > self::MAX_PART_BYTES) throw new RuntimeException('This Excel file is too big. Split it into smaller files.');
            $xml = $zip->getFromName($sheetPath);
        } finally {
            $zip->close();
        }
        if ($xml === false) throw new RuntimeException('We could not read the sheet in this Excel file.');

        $sheet = @simplexml_load_string($xml, 'SimpleXMLElement', LIBXML_NONET | LIBXML_COMPACT);
        if ($sheet === false) throw new RuntimeException('We could not read the sheet in this Excel file.');
        $main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
        $data = $sheet->children($main)->sheetData;

        $rows = [];
        $line = 0;
        foreach ($data ? $data->children($main)->row : [] as $row) {
            $line = (int) ((string) $row->attributes()->r ?: $line + 1);
            $cells = [];
            $column = 0;
            foreach ($row->children($main)->c as $cell) {
                $ref = (string) $cell->attributes()->r;
                $column = $ref !== '' ? self::columnIndex($ref) : $column;
                $cells[$column] = self::cellText($cell, (string) $cell->attributes()->t, $shared);
                $column++;
            }
            self::pushRow($rows, $line, $cells);
        }

        return $rows;
    }

    private static function pushRow(array &$rows, int $line, array $cells): void
    {
        if (!$cells) return;
        $max = max(array_keys($cells));
        $ordered = [];
        for ($i = 0; $i <= $max; $i++) $ordered[] = self::clean($cells[$i] ?? '');
        if (implode('', $ordered) === '') return;
        if (count($rows) >= self::MAX_ROWS) throw new RuntimeException('This file has more than ' . number_format(self::MAX_ROWS) . ' rows. Split it into smaller files.');
        $rows[] = [$line, $ordered];
    }

    private static function cellText(\SimpleXMLElement $cell, string $type, array $shared): string
    {
        $children = $cell->children('http://schemas.openxmlformats.org/spreadsheetml/2006/main');
        if ($type === 'inlineStr') return self::richText($children->is);
        if ($type === 'str' || $type === 'e') return isset($children->v) ? (string) $children->v : '';
        $value = isset($children->v) ? (string) $children->v : '';
        if ($type === 's') return $shared[(int) $value] ?? '';
        if ($type === 'b') return $value === '1' ? 'TRUE' : 'FALSE';
        // Whole numbers saved as numbers ("2023.0") read back as plain digits.
        if ($type === '' && is_numeric($value) && floor((float) $value) == (float) $value && abs((float) $value) < 1e15) {
            return (string) (int) $value;
        }
        return $value;
    }

    private static function richText($node): string
    {
        if (!$node) return '';
        $main = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
        $children = $node->children($main);
        if (isset($children->t)) return (string) $children->t;
        $text = '';
        foreach ($children->r as $run) $text .= (string) $run->children($main)->t;
        return $text;
    }

    private static function sharedStrings(ZipArchive $zip): array
    {
        $stat = $zip->statName('xl/sharedStrings.xml');
        if (!$stat) return [];
        if ($stat['size'] > self::MAX_PART_BYTES) throw new RuntimeException('This Excel file is too big. Split it into smaller files.');
        $xml = @simplexml_load_string((string) $zip->getFromName('xl/sharedStrings.xml'), 'SimpleXMLElement', LIBXML_NONET | LIBXML_COMPACT);
        if ($xml === false) return [];
        $strings = [];
        foreach ($xml->children('http://schemas.openxmlformats.org/spreadsheetml/2006/main')->si as $item) {
            $strings[] = self::richText($item);
        }
        return $strings;
    }

    // The first sheet in the workbook's tab order, found through the workbook relationships.
    private static function firstSheetPath(ZipArchive $zip): string
    {
        $workbook = @simplexml_load_string((string) $zip->getFromName('xl/workbook.xml'), 'SimpleXMLElement', LIBXML_NONET);
        $rels = @simplexml_load_string((string) $zip->getFromName('xl/_rels/workbook.xml.rels'), 'SimpleXMLElement', LIBXML_NONET);
        if ($workbook !== false && $rels !== false) {
            $sheets = $workbook->children('http://schemas.openxmlformats.org/spreadsheetml/2006/main')->sheets;
            $first = $sheets ? $sheets->children('http://schemas.openxmlformats.org/spreadsheetml/2006/main')->sheet[0] : null;
            if ($first) {
                $id = (string) $first->attributes('http://schemas.openxmlformats.org/officeDocument/2006/relationships')->id;
                foreach ($rels->children('http://schemas.openxmlformats.org/package/2006/relationships') as $rel) {
                    if ((string) $rel->attributes()->Id !== $id) continue;
                    $target = ltrim((string) $rel->attributes()->Target, '/');
                    return str_starts_with($target, 'xl/') ? $target : 'xl/' . $target;
                }
            }
        }
        return 'xl/worksheets/sheet1.xml';
    }

    private static function columnIndex(string $ref): int
    {
        $letters = preg_replace('/[^A-Z]/', '', strtoupper($ref));
        $index = 0;
        foreach (str_split($letters) as $letter) $index = $index * 26 + (ord($letter) - 64);
        return max(0, $index - 1);
    }

    private static function readCsv(string $path): array
    {
        $content = (string) file_get_contents($path);
        if (str_starts_with($content, "\xEF\xBB\xBF")) $content = substr($content, 3);
        if (!mb_check_encoding($content, 'UTF-8')) $content = mb_convert_encoding($content, 'UTF-8', 'Windows-1252');

        $firstLine = strtok($content, "\r\n") ?: '';
        $delimiter = ',';
        foreach ([';', "\t"] as $candidate) {
            if (substr_count($firstLine, $candidate) > substr_count($firstLine, $delimiter)) $delimiter = $candidate;
        }

        $handle = fopen('php://temp', 'r+');
        fwrite($handle, $content);
        rewind($handle);
        $rows = [];
        $line = 0;
        while (($cells = fgetcsv($handle, 0, $delimiter)) !== false) {
            $line++;
            if ($cells === [null]) continue;
            $cleaned = array_map(fn ($cell) => self::clean((string) $cell), $cells);
            if (implode('', $cleaned) === '') continue;
            if (count($rows) >= self::MAX_ROWS) { fclose($handle); throw new RuntimeException('This file has more than ' . number_format(self::MAX_ROWS) . ' rows. Split it into smaller files.'); }
            $rows[] = [$line, $cleaned];
        }
        fclose($handle);

        return $rows;
    }

    private static function clean(string $text): string
    {
        $text = str_replace("\u{00A0}", ' ', $text);
        return trim(preg_replace('/\s+/u', ' ', $text) ?? '');
    }
}
