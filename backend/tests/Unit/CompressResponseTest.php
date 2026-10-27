<?php

namespace Tests\Unit;

use App\Http\Middleware\CompressResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Tests\TestCase;

class CompressResponseTest extends TestCase
{
    private function through(Request $request, $response)
    {
        return (new CompressResponse())->handle($request, fn () => $response);
    }

    private function request(?string $acceptEncoding, string $method = 'GET'): Request
    {
        $request = Request::create('/api/example', $method);
        if ($acceptEncoding !== null) {
            $request->headers->set('Accept-Encoding', $acceptEncoding);
        }

        return $request;
    }

    private function bigPayload(): array
    {
        return ['data' => array_fill(0, 200, ['name' => 'Juan Dela Cruz', 'status' => 'approved'])];
    }

    public function test_large_json_is_gzipped_when_the_client_accepts_it(): void
    {
        $payload = $this->bigPayload();
        $plain = json_encode($payload);

        $response = $this->through($this->request('gzip, deflate, br'), new JsonResponse($payload));

        $this->assertSame('gzip', $response->headers->get('Content-Encoding'));
        $this->assertStringContainsString('Accept-Encoding', (string) $response->headers->get('Vary'));
        $this->assertSame((string) strlen($response->getContent()), $response->headers->get('Content-Length'));
        $this->assertLessThan(strlen($plain), strlen($response->getContent()));
        $this->assertSame($plain, gzdecode($response->getContent()));
    }

    public function test_response_is_left_alone_without_gzip_support_or_when_small(): void
    {
        $payload = $this->bigPayload();

        $none = $this->through($this->request(null), new JsonResponse($payload));
        $this->assertNull($none->headers->get('Content-Encoding'));
        $this->assertSame(json_encode($payload), $none->getContent());

        $small = $this->through($this->request('gzip'), new JsonResponse(['ok' => true]));
        $this->assertNull($small->headers->get('Content-Encoding'));
        $this->assertSame('{"ok":true}', $small->getContent());
    }

    public function test_global_stack_sends_the_compressed_length(): void
    {
        $payload = $this->bigPayload();
        Route::get('/api/_compress-probe', fn () => response()->json($payload));

        $response = $this->get('/api/_compress-probe', ['Accept-Encoding' => 'gzip']);

        $response->assertOk()->assertHeader('Content-Encoding', 'gzip');
        $this->assertSame((string) strlen($response->getContent()), $response->headers->get('Content-Length'));
        $this->assertSame(json_encode($payload), gzdecode($response->getContent()));

        $this->get('/api/_compress-probe')->assertOk()->assertJsonPath('data.0.name', 'Juan Dela Cruz')
            ->assertHeaderMissing('Content-Encoding');
    }

    public function test_already_encoded_binary_and_head_responses_are_not_touched(): void
    {
        $encoded = new JsonResponse($this->bigPayload());
        $encoded->headers->set('Content-Encoding', 'br');
        $this->assertSame('br', $this->through($this->request('gzip'), $encoded)->headers->get('Content-Encoding'));

        $image = new Response(str_repeat('x', 4000), 200, ['Content-Type' => 'image/png']);
        $this->assertNull($this->through($this->request('gzip'), $image)->headers->get('Content-Encoding'));

        $head = $this->through($this->request('gzip', 'HEAD'), new JsonResponse($this->bigPayload()));
        $this->assertNull($head->headers->get('Content-Encoding'));

        $file = new BinaryFileResponse(__FILE__);
        $this->assertNull($this->through($this->request('gzip'), $file)->headers->get('Content-Encoding'));
    }
}
