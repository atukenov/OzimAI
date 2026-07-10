interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}

export function Tabs<T extends string>({ value, onChange, options }: TabsProps<T>) {
  return (
    <div className="tabs" role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={opt.value === value}
          className={`tab ${opt.value === value ? 'active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

interface PillsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
}

export function Pills<T extends string>({ value, onChange, options }: PillsProps<T>) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {options.map((opt) => (
        <button key={opt.value} className={`pill ${opt.value === value ? 'active' : ''}`} onClick={() => onChange(opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
