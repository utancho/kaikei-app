import type { Account } from "../lib/types";
import { selectClass } from "../lib/formStyles";

const CATEGORY_LABELS: Record<string, string> = {
  ASSET: "資産",
  LIABILITY: "負債",
  EQUITY: "純資産",
  REVENUE: "収益",
  EXPENSE: "費用",
};

export function AccountSelect({
  accounts,
  value,
  onChange,
  placeholder = "勘定科目を選択",
  className = "",
}: {
  accounts: Account[];
  value: string;
  onChange: (accountId: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const grouped = accounts.reduce<Record<string, Account[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  return (
    <select className={`${selectClass} ${className}`} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {Object.entries(grouped).map(([category, accs]) => (
        <optgroup key={category} label={CATEGORY_LABELS[category] ?? category}>
          {accs.map((a) => (
            <option key={a.id} value={a.id}>
              {a.code} {a.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
