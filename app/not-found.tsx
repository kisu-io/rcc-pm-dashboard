export const dynamic = 'force-dynamic';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0F1B3D] flex items-center justify-center text-white p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-2">404</h1>
        <p className="text-sm text-slate-300">Page not found</p>
        <a href="/" className="text-xs text-blue-400 hover:underline mt-3 inline-block">← Back to dashboard</a>
      </div>
    </div>
  );
}