import { ChevronRight } from 'lucide-react';

/**
 * Horizontal process stepper — matches app surface theme.
 * Large arrows between steps; optional thin progress track under the arrow when the batch is in this process window.
 */
export default function ProcessProfileStepper({ steps, activeIndex, stepProgress = 0 }) {
  if (!steps?.length) {
    return (
      <div className="rounded-t-card border border-gray-200 bg-surface-card px-3 py-6 sm:px-6 text-center text-sm sm:text-base text-muted shadow-card">
        No equipment or process-time steps configured for this process. Add a process profile on the{' '}
        <span className="font-semibold text-gray-800">Production</span> page.
      </div>
    );
  }

  const safeProgress = Math.min(1, Math.max(0, Number(stepProgress) || 0));

  return (
    <div className="rounded-t-card border border-gray-200 border-b-0 bg-surface-card shadow-card overflow-hidden">
      <div className="px-2 py-4 sm:px-4 sm:py-5 md:px-6 md:py-6 2xl:px-8 2xl:py-8">
        <div
          className="flex w-full items-start overflow-x-auto overflow-y-visible pb-2 snap-x snap-mandatory md:overflow-visible md:pb-0"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {steps.map((step, i) => {
            const isActive = activeIndex === i;
            const isPast = activeIndex > i;
            const isConnectorToNext = i < steps.length - 1;
            const connectorFull = isPast;
            const connectorPartial = isActive && isConnectorToNext;

            return (
              <div
                key={step.id}
                className="flex min-w-[5.75rem] max-w-[11rem] flex-1 snap-center items-start sm:min-w-0 sm:max-w-none md:min-w-0"
              >
                <div className="flex w-full min-w-0 flex-col items-center px-0.5 sm:px-1">
                  <div
                    className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 sm:h-12 sm:w-12 sm:text-base md:h-14 md:w-14 md:text-lg 2xl:h-16 2xl:w-16 2xl:text-xl ${
                      isActive
                        ? 'bg-primary text-white shadow-md ring-2 ring-primary/40 ring-offset-2 ring-offset-surface-card scale-105'
                        : isPast
                          ? 'bg-primary/85 text-white border-2 border-primary-dark/30'
                          : 'bg-surface-card-warm text-gray-500 border-2 border-gray-200'
                    }`}
                    title={step.minutes ? `${step.minutes} min` : undefined}
                  >
                    {i + 1}
                  </div>
                  <div
                    className={`mt-2 w-full px-0.5 text-center ${
                      isActive
                        ? 'text-gray-900 font-bold text-sm sm:text-base md:text-lg 2xl:text-xl'
                        : 'text-gray-600 font-medium text-xs sm:text-sm md:text-base 2xl:text-lg'
                    }`}
                  >
                    <span className="line-clamp-3 break-words leading-snug">{step.label}</span>
                    {step.minutes > 0 && (
                      <div
                        className={`mt-1 tabular-nums text-xs sm:text-sm md:text-base ${
                          isActive ? 'text-primary font-semibold' : 'text-muted'
                        }`}
                      >
                        {step.minutes} min
                      </div>
                    )}
                  </div>
                </div>
                {isConnectorToNext && (
                  <div
                    className="flex min-w-[2.75rem] max-w-[5rem] flex-[1_1_2rem] flex-col items-center justify-start gap-1 self-start pt-3 sm:min-w-[3rem] sm:max-w-[6rem] sm:pt-4 md:pt-5 2xl:pt-6"
                    aria-hidden
                  >
                    <ChevronRight
                      strokeWidth={3}
                      className={`h-10 w-10 shrink-0 sm:h-12 sm:w-12 md:h-14 md:w-14 2xl:h-16 2xl:w-16 ${
                        isPast
                          ? 'text-primary drop-shadow-sm'
                          : isActive
                            ? 'text-primary/80'
                            : 'text-gray-300'
                      }`}
                    />
                    <div className="h-1.5 w-full max-w-[4rem] rounded-full bg-gray-200 overflow-hidden sm:max-w-[5rem]">
                      <div
                        className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                        style={{
                          width:
                            connectorFull ? '100%' : connectorPartial ? `${safeProgress * 100}%` : '0%',
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="border-t border-gray-200 bg-surface-card-warm/60" />
    </div>
  );
}
