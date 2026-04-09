interface Props {
  value: string
  onChange: (value: string) => void
  opcoes: string[]
  labels?: Record<string, string>
  placeholder?: string
}

export default function CampoSelect({ value, onChange, opcoes, labels, placeholder }: Props) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
    >
      {placeholder && (
        <option value="" disabled>{placeholder}</option>
      )}
      {opcoes.map((opcao) => (
        <option key={opcao} value={opcao}>
          {labels?.[opcao] ?? opcao}
        </option>
      ))}
    </select>
  )
}
