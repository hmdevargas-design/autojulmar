'use client'

import { useState, useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { ConfigTenant } from '@/core/entities'
import { calcularPreco } from '@/core/pricing/engine'
import type { InputPreco, ConfigPreco } from '@/core/pricing/types'
import ResumoPreco from './ResumoPreco'
import CampoMatricula from './fields/CampoMatricula'
import CampoSelect from './fields/CampoSelect'
import CampoMultiSelect from './fields/CampoMultiSelect'


const schema = z.object({
  matricula:       z.string().min(1, 'Matrícula obrigatória'),
  viatura:         z.string().optional(),
  ano:             z.string().optional(),
  combustivel:     z.string().optional(),
  nomeCliente:     z.string().min(1, 'Nome do cliente obrigatório'),
  contacto:        z.string().min(9, 'Contacto obrigatório'),
  material:        z.string().min(1, 'Material obrigatório'),
  tipoTapete:      z.array(z.string()).min(1, 'Tipo de tapete obrigatório'),
  extras:          z.array(z.string()),
  tipoClienteId:   z.string().min(1, 'Tipo de cliente obrigatório'),
  quantidade:      z.number().min(1),
  maisInfo:        z.string().optional(),
  descontoManual:  z.number().min(0),
  valor:           z.number().min(0),
  sinal:           z.number().min(0),
  formaPagamento:  z.string().min(1, 'Forma de pagamento obrigatória'),
})

type FormValues = z.infer<typeof schema>

interface Props {
  config: ConfigTenant
  configPreco: ConfigPreco
  tenantId: string
  tenantSlug: string
}

// Classes reutilizáveis para consistência
const inputCls = 'w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500'
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1'

export default function FormularioPedido({ config, configPreco, tenantId, tenantSlug }: Props) {
  const [submetido, setSubmetido] = useState(false)
  const [numeroPedido, setNumeroPedido] = useState<number | null>(null)
  const [extrasQuantidades, setExtrasQuantidades] = useState<Record<string, number>>({})
  const [clienteAutoPreenchido, setClienteAutoPreenchido] = useState(false)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      extras: [],
      tipoTapete: [],
      quantidade: 1,
      descontoManual: 0,
      sinal: 0,
    },
  })

  const material       = watch('material')
  const tipoTapete     = watch('tipoTapete')
  const extras         = watch('extras')
  const tipoClienteId  = watch('tipoClienteId')
  const quantidade     = watch('quantidade')
  const descontoManual = watch('descontoManual')
  const sinal          = watch('sinal')

  const inputPreco: InputPreco = {
    campo1Valor:       material        || '',
    campo2Valor:       tipoTapete?.[0] || '',
    extras:            extras          || [],
    extrasQuantidades,
    tipoClienteId:     tipoClienteId   || 'NORMAL',
    quantidade:        Number(quantidade)     || 1,
    descontoManual:    Number(descontoManual) || 0,
    sinal:             Number(sinal)          || 0,
  }

  const resultado = calcularPreco(inputPreco, configPreco)

  async function lookupCliente(input: string) {
    const trimmed = input.trim()
    if (!trimmed) return

    const digits = trimmed.replace(/\D/g, '')
    const pareceContacto = digits.length >= 9

    const url = pareceContacto
      ? `/api/clientes?tenantId=${tenantId}&contacto=${digits.slice(-9)}`
      : `/api/clientes?tenantId=${tenantId}&codigo=${encodeURIComponent(trimmed)}`

    try {
      const res = await fetch(url)
      if (!res.ok) return
      const cliente = await res.json()
      if (!cliente) return
      setValue('nomeCliente', cliente.nome)
      if (!pareceContacto && cliente.contacto) setValue('contacto', cliente.contacto)
      if (cliente.tipo_cliente_id) setValue('tipoClienteId', cliente.tipo_cliente_id)
      setClienteAutoPreenchido(true)
    } catch {
      // falha silenciosa — operador preenche manualmente
    }
  }

  useEffect(() => {
    setValue('valor', resultado.valorFinal)
  }, [resultado.valorFinal, setValue])

  async function onSubmit(data: FormValues) {
    try {
      const response = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          clienteNome:     data.nomeCliente,
          clienteContacto: data.contacto,
          tipoClienteId:   data.tipoClienteId,
          estadoId:        '',
          dados: {
            matricula:   data.matricula,
            viatura:     data.viatura,
            ano:         data.ano,
            combustivel: data.combustivel,
            maisInfo:    data.maisInfo,
          },
          material:          data.material,
          tipoTapete:        data.tipoTapete,
          extras:            data.extras,
          extrasQuantidades,
          quantidade:        data.quantidade,
          descontoManual:    data.descontoManual,
          sinal:             data.sinal,
          formaPagamento:    data.formaPagamento,
          origem:            'web',
        }),
      })

      const resultadoAPI = await response.json()

      if (!response.ok) {
        const detalhe = resultadoAPI.detalhes ? '\n' + JSON.stringify(resultadoAPI.detalhes) : ''
        throw new Error((resultadoAPI.erro ?? 'Erro ao criar pedido') + detalhe)
      }

      setNumeroPedido(resultadoAPI.numeroPedido)
      setSubmetido(true)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao criar pedido')
    }
  }

  if (submetido && numeroPedido) {
    return (
      <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6 text-center">
        <div className="text-3xl mb-2">✅</div>
        <h2 className="text-xl font-bold text-emerald-800 dark:text-emerald-300">Pedido #{numeroPedido} criado</h2>
        <p className="text-emerald-700 dark:text-emerald-400 mt-1">
          Valor final: <strong>{resultado.valorFinal.toFixed(2)}€</strong>
        </p>
        <div className="mt-4 flex gap-3 justify-center">
          <a
            href={`/${tenantSlug}/pedidos`}
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Ver listagem
          </a>
          <button
            onClick={() => { setSubmetido(false); setNumeroPedido(null) }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
          >
            Novo pedido
          </button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

      {/* Matrícula */}
      <div>
        <label className={labelCls}>
          Matrícula <span className="text-red-500">*</span>
        </label>
        <Controller
          name="matricula"
          control={control}
          render={({ field }) => (
            <CampoMatricula
              value={field.value}
              onChange={field.onChange}
              onViaturaChange={(viatura, ano, combustivel) => {
                setValue('viatura', viatura)
                setValue('ano', ano)
                setValue('combustivel', combustivel)
              }}
            />
          )}
        />
        {errors.matricula && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.matricula.message}</p>
        )}
      </div>

      {/* Viatura + Ano + Combustível */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1">
          <label className={labelCls}>Viatura</label>
          <input {...register('viatura')} className={inputCls} placeholder="Automático" />
        </div>
        <div>
          <label className={labelCls}>Ano</label>
          <input {...register('ano')} className={inputCls} placeholder="Automático" />
        </div>
        <div>
          <label className={labelCls}>Combustível</label>
          <input {...register('combustivel')} className={inputCls} placeholder="Automático" />
        </div>
      </div>

      {/* Cliente */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>
            Cliente <span className="text-red-500">*</span>
          </label>
          <input
            {...register('nomeCliente')}
            className={inputCls}
            placeholder="Nome do cliente"
          />
          {errors.nomeCliente && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.nomeCliente.message}</p>
          )}
        </div>
        <div>
          <label className={labelCls}>
            Contacto <span className="text-red-500">*</span>
          </label>
          <input
            {...register('contacto')}
            onBlur={e => {
              setClienteAutoPreenchido(false)
              lookupCliente(e.target.value)
            }}
            onChange={e => {
              register('contacto').onChange(e)
              setClienteAutoPreenchido(false)
            }}
            className={inputCls}
            placeholder="9XXXXXXXX ou código (ex: c12)"
          />
          {clienteAutoPreenchido && (
            <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">✓ Cliente encontrado no histórico</p>
          )}
          {errors.contacto && (
            <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.contacto.message}</p>
          )}
        </div>
      </div>

      {/* Material */}
      <div>
        <label className={labelCls}>
          Material <span className="text-red-500">*</span>
        </label>
        <Controller
          name="material"
          control={control}
          render={({ field }) => (
            <CampoSelect
              value={field.value}
              onChange={field.onChange}
              opcoes={[
                'ECO PRETO','CINZA CABRIO','GTI PRETO','GTI CINZA',
                'VELUDO PRETO','VELUDO CINZA','BORRACHA','CANELADO',
                'OUTROS','CAPAS','REPARAÇÃO','CHUVENTOS','TAPETES',
              ]}
              placeholder="Selecciona o material"
            />
          )}
        />
        {errors.material && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.material.message}</p>
        )}
      </div>

      {/* Tipo Tapete */}
      <div>
        <label className={labelCls}>
          Tipo Tapete <span className="text-red-500">*</span>
        </label>
        <Controller
          name="tipoTapete"
          control={control}
          render={({ field }) => (
            <CampoMultiSelect
              value={field.value}
              onChange={field.onChange}
              opcoes={[
                'JOGO','JOGO EM 3','JOGO EM 4','JOGO EM 5',
                'FRENTES','FRENTE COMERCIAL','MALA','3º','CONDUTOR',
                'TRASEIRO','TRASEIRO INTEIRO','TRÁS EM 3',
                'PENDURA','TECIDO DAIANA','TAP VIGUESA','REITAPETES','OUTROS',
              ]}
            />
          )}
        />
        {errors.tipoTapete && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.tipoTapete.message}</p>
        )}
      </div>

      {/* Extras */}
      <div>
        <label className={labelCls}>Extras</label>
        <Controller
          name="extras"
          control={control}
          render={({ field }) => (
            <CampoMultiSelect
              value={field.value}
              onChange={field.onChange}
              opcoes={[
                'reforço borracha','reforço alcatifa','molas condutor',
                'molas pendura','velcro','sem reforço','Ilhoses','Debrum em Lã',
              ]}
              comQuantidade={['velcro']}
              quantidades={extrasQuantidades}
              onQuantidadeChange={(opcao, qtd) =>
                setExtrasQuantidades(prev => ({ ...prev, [opcao]: qtd }))
              }
            />
          )}
        />
      </div>

      {/* Tipo Cliente */}
      <div>
        <label className={labelCls}>
          Tipo Cliente <span className="text-red-500">*</span>
        </label>
        <Controller
          name="tipoClienteId"
          control={control}
          render={({ field }) => (
            <CampoSelect
              value={field.value}
              onChange={field.onChange}
              opcoes={config.tiposCliente.map((t) => t.id)}
              labels={Object.fromEntries(
                config.tiposCliente.map((t) => [
                  t.id,
                  `${t.nome}${t.descontoPct > 0 ? ` (−${t.descontoPct}%)` : ''}`,
                ])
              )}
              placeholder="Selecciona o tipo"
            />
          )}
        />
        {errors.tipoClienteId && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.tipoClienteId.message}</p>
        )}
      </div>

      {/* Quantidade */}
      <div className="w-32">
        <label className={labelCls}>Quantidade</label>
        <input
          {...register('quantidade', { valueAsNumber: true })}
          type="number"
          min="1"
          className={inputCls}
        />
      </div>

      {/* Mais Info */}
      <div>
        <label className={labelCls}>Mais Info</label>
        <textarea
          {...register('maisInfo')}
          rows={2}
          className={inputCls}
          placeholder="Observações adicionais"
        />
      </div>

      {/* Resumo de preço em tempo real */}
      <ResumoPreco resultado={resultado} />

      {/* Desconto manual + Sinal */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Desconto Manual (€)</label>
          <input
            {...register('descontoManual', { valueAsNumber: true })}
            type="number"
            min="0"
            step="0.01"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Sinal (€)</label>
          <input
            {...register('sinal', { valueAsNumber: true })}
            type="number"
            min="0"
            step="0.01"
            className={inputCls}
          />
        </div>
      </div>

      {/* Valor final */}
      <div>
        <label className={labelCls}>
          Valor Final (€)
          <span className="ml-2 text-xs text-slate-400 dark:text-slate-500 font-normal">
            calculado: {resultado.valorFinal.toFixed(2)}€
          </span>
        </label>
        <input
          {...register('valor', { valueAsNumber: true })}
          type="number"
          min="0"
          step="0.01"
          className={inputCls}
        />
      </div>

      {/* Forma de pagamento */}
      <div>
        <label className={labelCls}>
          Forma de Pagamento <span className="text-red-500">*</span>
        </label>
        <Controller
          name="formaPagamento"
          control={control}
          render={({ field }) => (
            <CampoSelect
              value={field.value}
              onChange={field.onChange}
              opcoes={['PAGO','PAGAR_NA_ENTREGA','ENVIO_A_COBRANCA','TRANSFERENCIA']}
              labels={{
                'PAGO':             'PAGO',
                'PAGAR_NA_ENTREGA': 'PAGAR NA ENTREGA',
                'ENVIO_A_COBRANCA': 'ENVIO A COBRANÇA',
                'TRANSFERENCIA':    'TRANSFERÊNCIA',
              }}
              placeholder="Forma de pagamento"
            />
          )}
        />
        {errors.formaPagamento && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.formaPagamento.message}</p>
        )}
      </div>

      {/* Botão submeter */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? 'A criar pedido…' : 'Criar Pedido'}
      </button>
    </form>
  )
}
