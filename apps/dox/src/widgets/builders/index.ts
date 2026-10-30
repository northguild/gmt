/**
 * The builders. Each returns `SafeHtml` and writes the whole accessible
 * structure of its piece; the argument that names it is required in the type.
 */
export { aside, type AsideOptions } from "./aside";
export { badge, type BadgeOptions, type BadgeTone } from "./badge";
export { button, buttonRow, type ButtonOptions } from "./button";
export {
  chartKey,
  chartSummary,
  type ChartKeyItem,
  type ChartKeyKind,
} from "./chart-key";
export { codeFrame, type CodeFrameOptions } from "./code-frame";
export {
  dataCredits,
  type DataCredit,
  type DataCreditsOptions,
  type DataCreditsPlacement,
} from "./data-credits";
export {
  disclosure,
  wireDisclosure,
  type DisclosureHandle,
  type DisclosureOptions,
  type DisclosureWire,
} from "./disclosure";
export { gateAttr, type GateOption } from "./gate";
export { hero, type HeroOptions } from "./hero";
export {
  escapeAttr,
  escapeHtml,
  html,
  raw,
  SafeHtml,
  setHtml,
  type HtmlValue,
} from "./html";
export { idScope } from "./ids";
export { nobreak } from "./nobreak";
export { instant } from "./instant";
export {
  card,
  type CardOptions,
  field,
  fieldGrid,
  hint,
  section,
  widget,
  type FieldControlIds,
  type FieldOptions,
  type Hint,
  type SectionOptions,
  type WidgetRoot,
} from "./layout";
export { findWidget, type FoundWidget } from "../root";
export { loading, type LoadingOptions } from "./loading";
export { plates, NO_RESULT, type Plate } from "./plates";
export { select, type SelectOption, type SelectOptions } from "./select";
export { srOnly } from "./sr-only";
export {
  setSwitchDetail,
  switchField,
  type SwitchFieldOptions,
  type SwitchTone,
} from "./switch-field";
export { swatch, type SwatchOptions, type SwatchSeries } from "./swatch";
export {
  textInput,
  type TextInputMode,
  type TextInputOptions,
} from "./text-input";
export { table, type Column, type TableOptions } from "./table";
export {
  toolLinks,
  type ToolLinkItem,
  type ToolLinksOptions,
} from "./tool-links";
export {
  axis,
  lane,
  mark,
  tick,
  type LaneOptions,
  type MarkOptions,
  type TickOptions,
  type TimelineSeries,
} from "./timeline";
export { verdict, type VerdictOptions, type VerdictTone } from "./verdict";
