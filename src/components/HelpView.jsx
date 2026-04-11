import { ExternalLink, Download } from 'lucide-react';

// Served from /public/docs — same content as repo root "Order Production Planner App Manual.pdf" (copy on deploy if you update the root file).
const MANUAL_PDF_PATH = '/docs/order-production-planner-app-manual.pdf';

export default function HelpView() {
  const manualUrl = `${MANUAL_PDF_PATH}`;

  return (
    <div className="flex flex-1 flex-col min-h-0 max-w-[2500px] mx-auto w-full px-3 py-4 sm:px-5 sm:py-5 md:px-6">
      <div className="shrink-0 mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-3">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900">Help</h1>
          <p className="text-sm text-muted mt-0.5">Order Production Planner — app manual (PDF)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={manualUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden />
            Open in new tab
          </a>
          <a
            href={manualUrl}
            download="Order-Production-Planner-App-Manual.pdf"
            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/15"
          >
            <Download className="h-4 w-4 shrink-0" aria-hidden />
            Download
          </a>
        </div>
      </div>

      <div className="flex-1 min-h-[50vh] sm:min-h-[60vh] rounded-card border border-gray-200 bg-gray-100/80 shadow-card overflow-hidden flex flex-col">
        <iframe
          title="Order Production Planner app manual"
          src={`${manualUrl}#view=FitH`}
          className="w-full flex-1 min-h-[480px] border-0 bg-white"
        />
        <p className="shrink-0 px-3 py-2 text-xs text-muted bg-surface-card border-t border-gray-200">
          If the manual does not appear, use <strong className="text-gray-700">Open in new tab</strong> — some browsers block embedded PDFs.
        </p>
      </div>
    </div>
  );
}
