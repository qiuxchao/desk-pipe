import { Field } from "@flowgram.ai/free-layout-editor";
import { open } from "@tauri-apps/plugin-dialog";
import { VariableSelector } from "@/components/VariableSelector";
import { useNodeUpstream } from "@/contexts/UpstreamContext";

/** Node title bar */
export function TitleField({ className }: { className?: string }) {
  return (
    <Field<string> name="title">
      {({ field }) => (
        <div className={`demo-free-node-title ${className ?? ""}`}>
          {field.value}
        </div>
      )}
    </Field>
  );
}

/** Simple text input with label */
export function TextInput({ name, label, placeholder, mono }: {
  name: string; label: string; placeholder?: string; mono?: boolean;
}) {
  const upstreamNodes = useNodeUpstream();
  return (
    <div className="node-field">
      <Field<string> name={name}>
        {({ field }) => (
          <>
            <div className="node-field-label-row">
              <label>{label}</label>
              <VariableSelector
                onSelect={(v) => {
                  field.onChange((field.value || "") + v);
                }}
                upstreamNodes={upstreamNodes}
              />
            </div>
            <input
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
              placeholder={placeholder}
              className={mono ? "font-mono" : ""}
            />
          </>
        )}
      </Field>
    </div>
  );
}

/** Textarea for multi-line input */
export function TextArea({ name, label, placeholder, rows, mono }: {
  name: string; label: string; placeholder?: string; rows?: number; mono?: boolean;
}) {
  const upstreamNodes = useNodeUpstream();
  return (
    <div className="node-field">
      <Field<string> name={name}>
        {({ field }) => (
          <>
            <div className="node-field-label-row">
              <label>{label}</label>
              <VariableSelector
                onSelect={(v) => {
                  field.onChange((field.value || "") + v);
                }}
                upstreamNodes={upstreamNodes}
              />
            </div>
            <textarea
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
              rows={rows ?? 3}
              placeholder={placeholder}
              className={mono ? "font-mono" : ""}
            />
          </>
        )}
      </Field>
    </div>
  );
}

/** Select dropdown */
export function SelectField({ name, label, options }: {
  name: string; label: string; options: { value: string; label: string }[];
}) {
  return (
    <div className="node-field">
      <label>{label}</label>
      <Field<string> name={name}>
        <select>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
    </div>
  );
}

/** Inline row: left dropdown + right input (for HTTP method + URL) */
export function InlineRow({ children }: { children: React.ReactNode }) {
  return <div className="node-inline-row">{children}</div>;
}

/** Small dropdown for inline use */
export function InlineSelect({ name, options, width }: {
  name: string; options: { value: string; label: string }[]; width?: number;
}) {
  return (
    <Field<string> name={name}>
      <select style={{ width: width ?? 80 }} className="node-inline-select">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

/** File path input with system file picker button */
export function FilePathInput({ name, label, placeholder, saveMode }: {
  name: string; label: string; placeholder?: string; saveMode?: boolean;
}) {
  return (
    <div className="node-field">
      <label>{label}</label>
      <Field<string> name={name}>
        {({ field }) => (
          <div className="node-file-input">
            <input
              value={field.value ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
              placeholder={placeholder ?? "文件路径或 {{prev.path}}"}
              className="font-mono"
            />
            <button
              type="button"
              className="node-file-btn"
              onClick={async () => {
                try {
                  const result = await open({
                    multiple: false,
                    filters: saveMode ? undefined : undefined,
                  });
                  if (result) {
                    field.onChange(result as string);
                  }
                } catch (e) {
                  console.error(e);
                }
              }}
            >
              选择
            </button>
          </div>
        )}
      </Field>
    </div>
  );
}

/** Error strategy dropdown */
export function ErrorStrategySelect() {
  return (
    <div className="node-field node-field-separator">
      <label>出错时</label>
      <Field<string> name="on_error">
        <select>
          <option value="stop">停止工作流</option>
          <option value="continue">忽略继续</option>
          <option value="retry">重试 (最多3次)</option>
        </select>
      </Field>
    </div>
  );
}

/** Section separator inside node */
export function NodeSection({ children }: { children: React.ReactNode }) {
  return <div className="demo-free-node-content">{children}</div>;
}

/** Labeled section with border top */
export function NodeSectionDivider({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="demo-free-node-content node-section-divider">
      <div className="node-section-label">{label}</div>
      {children}
    </div>
  );
}

/** Checkbox field */
export function CheckboxField({ name, label }: { name: string; label: string }) {
  return (
    <div className="node-field node-checkbox">
      <Field<boolean> name={name}>
        <input type="checkbox" />
      </Field>
      <span>{label}</span>
    </div>
  );
}
