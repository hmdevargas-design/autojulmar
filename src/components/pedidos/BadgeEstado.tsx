interface Props {
  estado: string
  cor: string
}

export default function BadgeEstado({ estado, cor }: Props) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: cor + '20', color: cor }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: cor }}
      />
      {estado}
    </span>
  )
}
