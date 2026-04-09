interface Props {
  value: string[]
  onChange: (value: string[]) => void
  opcoes: string[]
  comQuantidade?: string[]
  quantidades?: Record<string, number>
  onQuantidadeChange?: (opcao: string, qtd: number) => void
}

export default function CampoMultiSelect({
  value, onChange, opcoes,
  comQuantidade = [], quantidades = {}, onQuantidadeChange,
}: Props) {
  function toggle(opcao: string) {
    if (value.includes(opcao)) {
      onChange(value.filter((v) => v !== opcao))
    } else {
      onChange([...value, opcao])
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {opcoes.map((opcao) => {
        const activo = value.includes(opcao)
        const temQtd = comQuantidade.includes(opcao)
        const qtd = quantidades[opcao] ?? 1

        return (
          <div key={opcao} className="flex items-center">
            <button
              type="button"
              onClick={() => toggle(opcao)}
              className={`px-2.5 py-1 text-xs font-medium border transition-colors ${
                temQtd && activo ? 'rounded-l' : 'rounded-lg'
              } ${
                activo
                  ? 'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
            >
              {opcao}
            </button>

            {temQtd && activo && (
              <input
                type="number"
                min="1"
                max="99"
                value={qtd}
                onChange={(e) => onQuantidadeChange?.(opcao, Math.max(1, Number(e.target.value)))}
                onClick={(e) => e.stopPropagation()}
                className="w-10 text-center text-xs border border-l-0 border-indigo-600 dark:border-indigo-500 rounded-r py-1 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-indigo-50 dark:bg-indigo-950"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
