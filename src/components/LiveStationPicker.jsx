import { Link } from 'react-router-dom';
import { SECTIONS } from './SectionTabs';

export default function LiveStationPicker() {
  return (
    <div className="min-h-screen bg-surface p-4 sm:p-6 flex flex-col items-center justify-center">
      <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">Live view</h1>
      <p className="text-sm text-muted mb-6">Select a station</p>
      <nav className="flex flex-wrap justify-center gap-3">
        {SECTIONS.map(({ id, label }) => (
          <Link
            key={id}
            to={`/live/${id}`}
            className="px-4 py-3 rounded-card shadow-card bg-surface-card border border-gray-100 text-gray-800 font-medium hover:bg-primary hover:text-white hover:border-primary transition-colors"
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
