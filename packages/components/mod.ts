/**
 * @denotui/components — bundled UI components built on `@denotui/runtime`.
 *
 * This package is the authoring surface for the framework's component catalog.
 * The compiler auto-imports only the fixed core vocabulary (see
 * `packages/compiler/src/codegen.ts`); everything else here is imported
 * explicitly in frontmatter, exactly like application components.
 *
 * Categories:
 *  - base: Box, Text, Map
 *  - layout: Row, Column, Center, Spacer, Divider, Panel
 *  - text: Badge, Alert
 *  - feedback: Spinner, ProgressBar
 *  - data: List, Table, KeyValue
 *  - controls: Button, TextInput, Select, Checkbox, Toggle, Tabs
 *  - chrome: StatusBar, HelpBar, Separator
 *  - scrolling: ScrollView
 *  - control flow: Show
 */
export { Box, Map, Text } from "./src/builtins.ts";
export { Center, Column, Divider, Panel, Row, Spacer } from "./src/layout.ts";
export { Alert, Badge } from "./src/text.ts";
export { ProgressBar, Spinner } from "./src/feedback.ts";
export { KeyValue, List, Table } from "./src/data.ts";
export {
  Button,
  Checkbox,
  Select,
  Tabs,
  TextInput,
  Toggle,
} from "./src/controls.ts";
export { HelpBar, Separator, StatusBar } from "./src/chrome.ts";
export { ScrollView } from "./src/scroll.ts";
export { Show } from "./src/show.ts";
