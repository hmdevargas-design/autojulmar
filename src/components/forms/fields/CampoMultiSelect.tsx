interface Props {
  value: string[]
  onChange: (value: string[]) => void
  opcoes: string[]
  // Opções que suportam quantidade (ex: ["velcro"])
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
                temQtd && activo ? 'rounded-l' : 'rounded'
              } ${
                activo
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400 hover:text-blue-600'
              }`}
            >
              {opcao}
            </button>

            {/* Input de quantidade — visível só quando activo e suporta quantidade */}
            {temQtd && activo && (
              <input
                type="number"
                min="1"
                max="99"
                value={qtd}
                onChange={(e) => onQuantidadeChange?.(opcao, Math.max(1, Number(e.target.value)))}
                onClick={(e) => e.stopPropagation()}
                className="w-10 text-center text-xs border border-l-0 border-blue-600 rounded-r py-1 text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-blue-50"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
