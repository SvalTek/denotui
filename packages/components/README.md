# @denotui/components

The bundled UI catalog for **denotui**:

- Base: `Box`, `Text`, `Map`
- Layout: `Row`, `Column`, `Center`, `Spacer`, `Divider`, `Panel`
- Text/feedback: `Badge`, `Alert`, `Spinner`, `ProgressBar`
- Data: `List`, `Table`, `KeyValue`
- Controls: `Button`, `TextInput`, `Select`, `Checkbox`, `Toggle`, `Tabs`
- Chrome: `StatusBar`, `HelpBar`, `Separator`
- Scrolling and control flow: `ScrollView`, `Show`

All are ordinary components built on `@denotui/runtime`. The compiler
auto-imports the core vocabulary from the app barrel; `Separator` and custom
components are imported in frontmatter.

Docs: [`docs/guide/components.md`](../../docs/guide/components.md) and
[`docs/reference/components.md`](../../docs/reference/components.md).
