import api from '../../../services/api';
import { downloadFile, toCsv, toXlsx } from '../../../utils/tableExport';
import { MOVEMENTS, changeOf, dateTime, personName, reasonText } from './medicineOptions';

/*
 * Download a medicine's stock history as CSV or Excel. The whole history is fetched (not just the page
 * on screen) with the same date and movement filters the nurse has chosen.
 */
export const HISTORY_HEADER = ['Date & Time', 'Movement', 'Quantity Change', 'Stock Before', 'Stock After', 'Performed By', 'Reference / Reason'];

export const historyRows = movements => [
  HISTORY_HEADER,
  ...movements.map(movement => [
    dateTime(movement.created_at),
    MOVEMENTS[movement.movement_type]?.label || movement.movement_type,
    changeOf(movement),
    movement.stock_before ?? '',
    movement.stock_after ?? '',
    personName(movement.performer),
    reasonText(movement),
  ]),
];

const slug = value => String(value).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'medicine';

export async function exportStockHistory(medicine, format, filters = {}) {
  const params = { all: 1 };
  if (filters.from) params.from = filters.from;
  if (filters.to) params.to = filters.to;
  if (filters.type) params.type = filters.type;
  const { data } = await api.get(`/nurse/medicines/${medicine.id}/movements`, { params });
  const movements = Array.isArray(data.data) ? data.data : (data.data?.data || []);
  const rows = historyRows(movements);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const base = `Stock-History-${slug(medicine.name)}-${today}`;
  if (format === 'xlsx') downloadFile(toXlsx(rows, `Stock History - ${medicine.name}`), `${base}.xlsx`);
  else downloadFile(toCsv(rows), `${base}.csv`);
  return movements.length;
}
