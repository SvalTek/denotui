# Components

denotui ships a catalog of ordinary components built on runtime primitives. The
compiler auto-imports the core vocabulary from the app barrel; `Separator` and
application components are imported in frontmatter.

## Catalog

| Group        | Components                                                    |
| ------------ | ------------------------------------------------------------- |
| Base         | `Box`, `Text`, `Map`                                          |
| Layout       | `Row`, `Column`, `Center`, `Spacer`, `Divider`, `Panel`       |
| Text         | `Badge`, `Alert`                                              |
| Feedback     | `Spinner`, `ProgressBar`                                      |
| Data         | `List`, `Table`, `KeyValue`                                   |
| Controls     | `Button`, `TextInput`, `Select`, `Checkbox`, `Toggle`, `Tabs` |
| Chrome       | `StatusBar`, `HelpBar`, `Separator`                           |
| Scrolling    | `ScrollView`                                                  |
| Control flow | `Show`                                                        |

Props are listed exhaustively in
[Reference: components](../reference/components.md).

## Containers

`Box` is the flex container; `Row`/`Column` are direction presets. `Center`
centers on both axes and grows by default; `Spacer` grows to fill space.

```tui
<Column padding={1} gap={1} bg={234}>
  <Row gap={2}>
    <Text bold>Left</Text>
    <Spacer />
    <Text dim>Right</Text>
  </Row>
  <Divider />
  <Center height={5}>
    <Badge label="centered" />
  </Center>
</Column>
```

`Panel` adds a border and padding; `Divider` is a one-cell line.

```tui
<Panel border="round" borderColor="cyan" padding={1}>
  <Text>Panel content</Text>
</Panel>
```

## Lists and selection

`Map` iterates an array and keys rows by `item.id`/`item.key`, else index:

```tui
<Map for={$agents}>
  {(agent: Agent) => <Text>{agent.name}</Text>}
</Map>
```

`List` renders selectable-looking rows without handling keys; `Select` adds
focus and arrow/Enter handling. Both take a function child:

```tui
<List items={$agents} selected={1}>
  {(agent: Agent, index: number, selected: boolean) => (
    <Text bold={selected}>{agent.name}</Text>
  )}
</List>

<Select
  items={filteredAgents($agents, $filter)}
  selected={$selected}
  onChange={selectAgent}
>
  {(item: Agent, index: number, selected: boolean) => (
    <Text bold={selected}>{item.name}</Text>
  )}
</Select>
```

`Select` callbacks: `onChange(item, index)` when the selection moves,
`onSelect(item, index)` on Enter. It is controlled when `selected` is provided
and keeps an internal index otherwise.

## Controls

Controls own focus and key handling; see
[Input and focus](./input-and-focus.md).

```tui
<TextInput
  value={$name}
  placeholder="your name"
  autoFocus
  onChange={setName}
  onSubmit={submit}
/>

<Checkbox checked={$agree} label="I agree" onChange={setAgree} />
<Toggle on={$verbose} label="Verbose" onChange={setVerbose} />
<Button label="Run" onPress={run} />
```

`TextInput` is controlled: it calls `onChange` with the next value and keeps an
internal cursor. `Checkbox`/`Toggle` accept controlled props and an `onChange`;
without a controlled prop they update internally.

## Data display

```tui
<Table
  columns={[
    { key: "name", title: "Name" },
    { key: "age", title: "Age", align: "right" },
  ]}
  rows={$agents}
/>

<KeyValue items={{ status: "ready", region: "eu-west" }} />
```

Table column widths use display cells, so CJK alignment is preserved. `KeyValue`
accepts an array of `{ label, value }` or a plain object.

## Feedback

`Spinner` owns a frontmatter timer and cleans it up on unmount. `ProgressBar`
renders filled/empty cells plus a percentage.

```tui
<Spinner active={$working} label="working" />
<ProgressBar value={$progress} label="progress" width={20} />
```

## Chrome

`StatusBar` lays out left/right text on a surface; `HelpBar` renders key hints.

```tui
<StatusBar left="AgentZoo" right={`${$agents.length} agents`} bg="blue" />
<HelpBar items={[{ key: "tab", label: "focus" }, { key: "esc", label: "quit" }]} />
```

## Conditional and scrolling

```tui
<Show when={$details !== null}>
  <Text>{$details?.name ?? ""}</Text>
</Show>

<ScrollView height={8} contentHeight={$log.length} focusable>
  {$log.map((line: string, index: number) => (
    <Text key={index} dim>{line}</Text>
  ))}
</ScrollView>
```

`ScrollView` clips its children. Control `scroll` yourself or make it
`focusable` and provide `contentHeight` so arrow/Page/Home/End keys can clamp.

## Writing your own

A component is a module that calls `component(name, factory)`; the factory
receives `props` and `ctx` and returns a render function:

```ts
import { component, h } from "@denotui/deno-tui";

export const Label = component(
  "Label",
  (props) => () =>
    h("text", { bold: props.bold === true }, [String(props.text ?? "")]),
);
```

In practice, author components as `.tui` files and import them, or compose the
catalog with `h()` when writing code by hand.
