import { usePlan } from '../context/PlanContext';

export default function SchedulingView() {
  const { planDate, setPlanDate, rows, setRows, reorderRows } = usePlan();

  const handlePlanDateChange = (e) => {
    const v = e.target.value;
    if (!v) return;
    const d = new Date(v);
    if (!isNaN(d.getTime())) setPlanDate(d);
  };

  const handleCellChange = (rowId, field, value) => {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r))
    );
  };

  const handleMoveUp = (index) => {
    if (index <= 0) return;
    reorderRows(index, index - 1);
  };

  const handleMoveDown = (index) => {
    if (index >= rows.length - 1) return;
    reorderRows(index, index + 1);
  };

  const formatDateInput = (d) => {
    if (!d || !(d instanceof Date)) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1200px] mx-auto w-full min-w-0">
      <h2 className="text-lg sm:text-xl md:text-2xl 2xl:text-3xl font-semibold text-gray-900 mb-4 sm:mb-6">Scheduling</h2>

      <div className="bg-surface-card rounded-card shadow-card p-4 mb-6">
        <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Plan date</label>
        <input
          type="date"
          value={formatDateInput(planDate)}
          onChange={handlePlanDateChange}
          className="border border-gray-300 rounded-lg px-3 py-2 text-gray-900 text-sm sm:text-base w-full max-w-xs"
        />
      </div>

      <div className="bg-surface-card rounded-card shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs sm:text-sm md:text-base 2xl:text-lg">
            <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">Order</th>
              <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">Product</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">SO Qty</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">Theor. Output</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">Capacity</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">Proc.Time</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">Start Sponge</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">End Dough</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">End Batch</th>
                <th className="text-left py-2 sm:py-3 px-2 sm:px-4 font-semibold text-gray-700 text-xs sm:text-sm">Batch</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="py-2 px-4">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveUp(index)}
                        disabled={index === 0}
                        className="p-1 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100"
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveDown(index)}
                        disabled={index === rows.length - 1}
                        className="p-1 rounded border border-gray-300 disabled:opacity-50 hover:bg-gray-100"
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                    </div>
                  </td>
                  <td className="py-2 px-4">
                    <input
                      type="text"
                      value={row.product ?? ''}
                      onChange={(e) => handleCellChange(row.id, 'product', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 w-full max-w-[180px] text-gray-900"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <input
                      type="number"
                      value={row.soQty ?? ''}
                      onChange={(e) => handleCellChange(row.id, 'soQty', Number(e.target.value) || 0)}
                      className="border border-gray-300 rounded px-2 py-1 w-20 text-gray-900"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <input
                      type="number"
                      value={row.theorOutput ?? ''}
                      onChange={(e) => handleCellChange(row.id, 'theorOutput', Number(e.target.value) || 0)}
                      className="border border-gray-300 rounded px-2 py-1 w-20 text-gray-900"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <input
                      type="number"
                      value={row.capacity ?? ''}
                      onChange={(e) => handleCellChange(row.id, 'capacity', Number(e.target.value) || 0)}
                      className="border border-gray-300 rounded px-2 py-1 w-20 text-gray-900"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <input
                      type="number"
                      value={row.procTime ?? ''}
                      onChange={(e) => handleCellChange(row.id, 'procTime', Number(e.target.value) || 0)}
                      className="border border-gray-300 rounded px-2 py-1 w-16 text-gray-900"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <input
                      type="text"
                      value={row.startSponge ?? ''}
                      onChange={(e) => handleCellChange(row.id, 'startSponge', e.target.value)}
                      placeholder="HH:MM"
                      className="border border-gray-300 rounded px-2 py-1 w-20 text-gray-900"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <input
                      type="text"
                      value={row.endDough ?? ''}
                      onChange={(e) => handleCellChange(row.id, 'endDough', e.target.value)}
                      placeholder="HH:MM"
                      className="border border-gray-300 rounded px-2 py-1 w-20 text-gray-900"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <input
                      type="text"
                      value={row.endBatch ?? ''}
                      onChange={(e) => handleCellChange(row.id, 'endBatch', e.target.value)}
                      placeholder="HH:MM"
                      className="border border-gray-300 rounded px-2 py-1 w-20 text-gray-900"
                    />
                  </td>
                  <td className="py-2 px-4">
                    <input
                      type="text"
                      value={row.batch ?? ''}
                      onChange={(e) => handleCellChange(row.id, 'batch', e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 w-16 text-gray-900"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="p-3 text-xs sm:text-sm text-muted bg-gray-50 border-t border-gray-200">
          Changes here are reflected on the Dashboard. Use Add batch on the Dashboard table to add more rows.
        </p>
      </div>
    </div>
  );
}
