import { Plus, ArrowUpDown, Download, FileText, Eye, Trash2 } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { usePlan } from '../context/PlanContext';
import { getOrderBatchAndLineBatch } from '../store/planStore';
import { computeStageDurationsForRow } from '../utils/stageDurations';
import { getProductionStatus } from '../utils/productionStatus';
import { getCapacityForProduct, getDoughWeightKgForProduct } from '../store/capacityProfileStore';

const MIXING_COLUMNS = [
  { key: 'product', label: 'Product' },
  { key: 'salesOrder', label: 'Sales Order' },
  { key: 'soQty', label: 'Total Qty' },
  { key: 'soCoExcess', label: 'SO-CO Excess' },
  { key: 'exchangeForLoss', label: 'Exch. Loss' },
  { key: 'excess', label: 'Excess' },
  { key: 'samples', label: 'Samples' },
  { key: 'carryOverExcess', label: 'Carry Over' },
  { key: 'theorExcess', label: 'Theor. Excess' },
  { key: 'theorOutput', label: 'Batch Qty' },
  { key: 'capacity', label: 'Capacity' },
  { key: 'doughWeightKg', label: 'Dough (kg)' },
  { key: 'procTime', label: 'Proc.Time' },
  { key: 'startSponge', label: 'Start Sponge' },
  { key: 'endDough', label: 'End Dough' },
  { key: 'endBatch', label: 'End Batch' },
  { key: 'orderBatch', label: 'Order Batch' },
  { key: 'batch', label: 'Line Batch' },
  { key: 'productionStatus', label: 'Production Status' },
];

const SECTION_COLUMNS = {
  mixing: MIXING_COLUMNS,
  'makeup-dividing': [
    { key: 'product', label: 'Product' },
    { key: 'salesOrder', label: 'Sales Order' },
    { key: 'soQty', label: 'Total Qty' },
    { key: 'soCoExcess', label: 'SO-CO Excess' },
    { key: 'exchangeForLoss', label: 'Exch. Loss' },
    { key: 'excess', label: 'Excess' },
    { key: 'samples', label: 'Samples' },
    { key: 'carryOverExcess', label: 'Carry Over' },
    { key: 'theorExcess', label: 'Theor. Excess' },
    { key: 'theorOutput', label: 'Batch Qty' },
    { key: 'capacity', label: 'Capacity' },
    { key: 'doughWeightKg', label: 'Dough (kg)' },
    { key: 'procTime', label: 'Proc.Time' },
    { key: 'startSponge', label: 'Start Dividing' },
    { key: 'endDough', label: 'End Dividing' },
    { key: 'endBatch', label: 'End Batch' },
    { key: 'orderBatch', label: 'Order Batch' },
    { key: 'batch', label: 'Line Batch' },
    { key: 'productionStatus', label: 'Production Status' },
  ],
  'makeup-panning': [
    { key: 'product', label: 'Product' },
    { key: 'salesOrder', label: 'Sales Order' },
    { key: 'soQty', label: 'Total Qty' },
    { key: 'soCoExcess', label: 'SO-CO Excess' },
    { key: 'exchangeForLoss', label: 'Exch. Loss' },
    { key: 'excess', label: 'Excess' },
    { key: 'samples', label: 'Samples' },
    { key: 'carryOverExcess', label: 'Carry Over' },
    { key: 'theorExcess', label: 'Theor. Excess' },
    { key: 'theorOutput', label: 'Batch Qty' },
    { key: 'capacity', label: 'Capacity' },
    { key: 'doughWeightKg', label: 'Dough (kg)' },
    { key: 'procTime', label: 'Proc.Time' },
    { key: 'startSponge', label: 'Start Panning' },
    { key: 'endDough', label: 'End Panning' },
    { key: 'endBatch', label: 'End Batch' },
    { key: 'orderBatch', label: 'Order Batch' },
    { key: 'batch', label: 'Line Batch' },
    { key: 'productionStatus', label: 'Production Status' },
  ],
  baking: [
    { key: 'product', label: 'Product' },
    { key: 'salesOrder', label: 'Sales Order' },
    { key: 'soQty', label: 'Total Qty' },
    { key: 'soCoExcess', label: 'SO-CO Excess' },
    { key: 'exchangeForLoss', label: 'Exch. Loss' },
    { key: 'excess', label: 'Excess' },
    { key: 'samples', label: 'Samples' },
    { key: 'carryOverExcess', label: 'Carry Over' },
    { key: 'theorExcess', label: 'Theor. Excess' },
    { key: 'theorOutput', label: 'Batch Qty' },
    { key: 'capacity', label: 'Capacity' },
    { key: 'doughWeightKg', label: 'Dough (kg)' },
    { key: 'procTime', label: 'Proc.Time' },
    { key: 'startSponge', label: 'Start Baking' },
    { key: 'endDough', label: 'End Baking' },
    { key: 'endBatch', label: 'End Batch' },
    { key: 'orderBatch', label: 'Order Batch' },
    { key: 'batch', label: 'Line Batch' },
    { key: 'productionStatus', label: 'Production Status' },
  ],
  packaging: [
    { key: 'product', label: 'Product' },
    { key: 'salesOrder', label: 'Sales Order' },
    { key: 'soQty', label: 'Total Qty' },
    { key: 'soCoExcess', label: 'SO-CO Excess' },
    { key: 'exchangeForLoss', label: 'Exch. Loss' },
    { key: 'excess', label: 'Excess' },
    { key: 'samples', label: 'Samples' },
    { key: 'carryOverExcess', label: 'Carry Over' },
    { key: 'theorExcess', label: 'Theor. Excess' },
    { key: 'theorOutput', label: 'Batch Qty' },
    { key: 'capacity', label: 'Capacity' },
    { key: 'doughWeightKg', label: 'Dough (kg)' },
    { key: 'procTime', label: 'Proc.Time' },
    { key: 'startSponge', label: 'Start Sponge' },
    { key: 'endDough', label: 'End Packaging' },
    { key: 'endBatch', label: 'End Batch' },
    { key: 'orderBatch', label: 'Order Batch' },
    { key: 'batch', label: 'Line Batch' },
    { key: 'productionStatus', label: 'Production Status' },
  ],
};

export default function PlanTable({ sectionId, onAddBatch, addButtonLabel = 'Add batch', onDeleteBatch, onReorder, onExport, onExportPdf, onLiveView, maxRows }) {
  const { rows: fullRows } = usePlan();
  const rows = typeof maxRows === 'number' && maxRows > 0 ? fullRows.slice(0, maxRows) : fullRows;
  const baseColumns = SECTION_COLUMNS[sectionId] || MIXING_COLUMNS;
  const restColumns = baseColumns.filter((c) => c.key !== 'productionStatus');
  const columns = [
    { key: 'productionStatus', label: 'Production Status' },
    ...(onDeleteBatch ? [{ key: 'actions', label: 'Actions' }] : []),
    ...restColumns,
  ];

  const [statusTick, setStatusTick] = useState(() => Date.now());
  useEffect(() => {
    const interval = setInterval(() => setStatusTick(Date.now()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const { orderBatch: orderBatchMap, lineBatch: lineBatchMap } = useMemo(
    () => getOrderBatchAndLineBatch(rows),
    [rows]
  );

  const stageDurationsById = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      map.set(row.id, computeStageDurationsForRow(row));
    });
    return map;
  }, [rows]);

  const getProcTimeForSection = (rowId) => {
    const stages = stageDurationsById.get(rowId);
    if (!stages) return '—';
    switch (sectionId) {
      case 'mixing':
        return stages.mixing;
      case 'makeup-dividing':
        return stages.makeupDividing;
      case 'makeup-panning':
        return stages.makeupPanning;
      case 'baking':
        return stages.baking;
      case 'packaging':
        return stages.packaging;
      default:
        return stages.mixing;
    }
  };

  return (
    <div className="bg-surface-card rounded-b-card shadow-card overflow-hidden border border-t-0 border-gray-200">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs sm:text-sm md:text-base 2xl:text-lg">
          <thead>
            <tr className="bg-surface-card-warm border-b border-gray-200">
              {columns.map(({ key, label }) => (
                <th key={key} className="text-left py-2 sm:py-3 px-3 sm:px-4 font-semibold text-gray-700 whitespace-nowrap text-inherit">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowStatus = getProductionStatus(row, statusTick);
              return (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50/50 bg-surface-card">
                  {columns.map(({ key }) => {
                    if (key === 'actions') {
                      return (
                        <td key={key} className="py-2 sm:py-2.5 px-3 sm:px-4">
                          <button
                            type="button"
                            onClick={() => onDeleteBatch(row.id)}
                            disabled={rowStatus === 'In Progress'}
                            className="p-1.5 rounded border border-gray-300 hover:bg-red-50 hover:border-red-300 text-gray-600 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                            aria-label={rowStatus === 'In Progress' ? 'Cannot delete batch in progress' : 'Delete row'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      );
                    }
                    let value;
                    if (key === 'orderBatch') {
                      value = orderBatchMap[row.id] ?? '—';
                    } else if (key === 'batch') {
                      value = lineBatchMap[row.id] ?? row[key] ?? '—';
                    } else if (key === 'productionStatus') {
                      const statusClass =
                        rowStatus === 'In Progress'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : rowStatus === 'Finished'
                            ? 'bg-green-100 text-green-800 border-green-200'
                            : 'bg-gray-100 text-gray-700 border-gray-200';
                      value = (
                        <span className={`inline-block px-2 py-0.5 rounded border text-xs font-medium ${statusClass}`}>
                          {rowStatus}
                        </span>
                      );
                    } else if (key === 'procTime') {
                      value = getProcTimeForSection(row.id);
                    } else if (key === 'capacity') {
                      value = getCapacityForProduct(row.product, row.productionLineId) ?? row[key] ?? '—';
                    } else if (key === 'doughWeightKg') {
                      value = getDoughWeightKgForProduct(row.product, row.productionLineId) != null ? `${getDoughWeightKgForProduct(row.product, row.productionLineId)} kg` : '—';
                    } else {
                      value = row[key] ?? '—';
                    }
                    return (
                      <td key={key} className="py-2 sm:py-2.5 px-3 sm:px-4 text-gray-800 text-inherit">
                        {value}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 p-2 sm:p-3 bg-surface-card-warm border-t border-gray-200 text-xs sm:text-sm 2xl:text-base">
        <div className="flex items-center flex-wrap gap-2 sm:gap-3">
          {onAddBatch && (
            <button
              type="button"
              onClick={onAddBatch}
              className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors text-inherit"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              {addButtonLabel}
            </button>
          )}
        </div>
        {(onReorder || onExport || onExportPdf || onLiveView) && (
          <div className="flex items-center flex-wrap gap-2 sm:gap-3 ml-auto">
            {onReorder && (
              <button
                type="button"
                onClick={() => onReorder?.()}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors text-inherit"
              >
                <ArrowUpDown className="w-4 h-4" />
                Reorder
              </button>
            )}
            {onExport && (
              <button
                type="button"
                onClick={onExport}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors text-inherit"
              >
                <Download className="w-4 h-4" />
                Export (CSV/JSON)
              </button>
            )}
            {onExportPdf && (
              <button
                type="button"
                onClick={onExportPdf}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors text-inherit"
              >
                <FileText className="w-4 h-4" />
                PDF
              </button>
            )}
            {onLiveView && (
              <button
                type="button"
                onClick={onLiveView}
                className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition-colors text-inherit"
              >
                <Eye className="w-4 h-4" />
                Live view
              </button>
            )}
          </div>
        )}
      </footer>
    </div>
  );
}
