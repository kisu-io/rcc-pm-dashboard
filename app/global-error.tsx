'use client';

/** Last-resort boundary for failures in the root layout itself. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="vi">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif', background: '#0F1B3D', color: '#fff' }}>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 420, textAlign: 'center' }}>
            <h1 style={{ fontSize: 18, margin: 0 }}>Ứng dụng không khởi động được</h1>
            <p style={{ fontSize: 14, opacity: 0.75, marginTop: 12 }}>
              Đã xảy ra lỗi ngoài dự kiến. Thử tải lại trang.
            </p>
            <button
              onClick={reset}
              style={{ marginTop: 20, fontSize: 14, background: '#2563eb', color: '#fff', border: 0, padding: '8px 16px', borderRadius: 8, cursor: 'pointer' }}
            >
              Thử lại
            </button>
            {error.digest && (
              <p style={{ fontSize: 10, opacity: 0.5, marginTop: 16, fontFamily: 'monospace' }}>Mã lỗi: {error.digest}</p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
