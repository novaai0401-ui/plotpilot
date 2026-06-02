"use client";
/**
 * Re-exports of tekivex-ui components.
 *
 * History:
 *  - tekivex-ui 3.0.3: needed `next/dynamic({ ssr: false })` per component because
 *    the Vite-built dist's chunks weren't compatible with Next.js webpack RSC
 *    chunk loading. See INTEGRATION_NOTES.md for the original symptom.
 *  - tekivex-ui 3.18.0: static imports work cleanly — kept this barrel as a
 *    thin pass-through so future changes still touch one file.
 *  - tekivex-ui 3.19.0 (current): no API changes affecting us; sideEffects map
 *    now correct, split entry points added (./headless, ./charts, etc.).
 *    Build green, tests green, bundle sizes unchanged from 3.18.1 — tracked
 *    in tekivex-ui#31.
 *
 * Keeping this barrel file (even with static re-exports) means every consumer
 * keeps importing from `@/components/tkx-dyn` — if we ever need to dynamic-load
 * again, we change one file, not 8.
 */

export {
  ThemeProvider,
  TkxToastProvider,
  TkxButton,
  TkxCard,
  TkxCardHeader,
  TkxCardBody,
  TkxInput,
  TkxSelect,
  TkxNumberInput,
  TkxCheckbox,
  TkxBadge,
  TkxAlert,
  TkxModal,
  TkxStepper,
  TkxStatistic,
  TkxEmpty,
  TkxTable,
  useToast,
} from "tekivex-ui";

export type {
  TkxButtonProps,
  TkxCardProps,
  TkxCardHeaderProps,
  TkxInputProps,
  TkxSelectProps,
  TkxNumberInputProps,
  TkxCheckboxProps,
  TkxBadgeProps,
  TkxAlertProps,
  TkxModalProps,
  TkxStepperProps,
  TkxStatisticProps,
  TkxEmptyProps,
  TkxTableProps,
  SelectOption,
  ColumnDef,
} from "tekivex-ui";
