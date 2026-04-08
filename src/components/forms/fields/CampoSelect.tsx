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
      className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
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
