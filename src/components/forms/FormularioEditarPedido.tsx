'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
  matricula:      z.string().optional(),
  viatura:        z.string().optional(),
  ano:            z.string().optional(),
  combustivel:    z.string().optional(),
  material:       z.string().min(1, 'Material obrigatório'),
  tipoTapete:     z.array(z.string()).min(1, 'Tipo de tapete obrigatório'),
  extras:         z.array(z.string()),
  tipoClienteId:  z.string().min(1, 'Tipo de cliente obrigatório'),
  quantidade:     z.number().min(1),
  maisInfo:       z.string().optional(),
  descontoManual: z.number().min(0),
  valor:          z.number().min(0),
  sinal:          z.number().min(0),
  formaPagamento: z.string().min(1, 'Forma de pagamento obrigatória'),
})

type FormValues = z.infer<typeof schema>

export interface DefaultValuesEditar {
  matricula?: string
  viatura?: string
  ano?: string
  combustivel?: string
  material?: string
  tipoTapete?: string[]
  extras?: string[]
  extrasQuantidades?: Record<string, number>
  quantidade?: number
  maisInfo?: string
  tipoClienteId?: string
  descontoManual?: number
  valor?: number
  sinal?: number
  formaPagamento?: string
}

interface Props {
  pedidoId:     string
  tenantId:     string
  tenantSlug:   string
  clienteNome:  string
  config:       ConfigTenant
  configPreco:  ConfigPreco
  defaultValues: DefaultValuesEditar
}

const inputCls = 'w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-gold'
const labelCls = 'block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1'

export default function FormularioEditarPedido({
  pedidoId, tenantId, tenantSlug, clienteNome,
  config, configPreco, defaultValues: dv,
}: Props) {
  const router = useRouter()
  const [extrasQuantidades, setExtrasQuantidades] = useState<Record<string, number>>(dv.extrasQuantidades ?? {})

  function valoresDeCampo(nomeCampo: string): string[] {
    return config.campos
      .find(c => c.nome === nomeCampo)
      ?.opcoes.filter(o => o.activo)
      .map(o => o.valor) ?? []
  }

  function labelsDeCampo(nomeCampo: string): Record<string, string> {
    return Object.fromEntries(
      config.campos
        .find(c => c.nome === nomeCampo)
        ?.opcoes.filter(o => o.activo)
        .map(o => [o.valor, o.label]) ?? []
    )
  }

  const opcoesMaterial = valoresDeCampo('material')
  const opcoesTipoTap  = valoresDeCampo('tipo_tapete')
  const opcoesExtras   = valoresDeCampo('extras')

  const { register, handleSubmit, control, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      matricula:      dv.matricula      ?? '',
      viatura:        dv.viatura        ?? '',
      ano:            dv.ano            ?? '',
      combustivel:    dv.combustivel    ?? '',
      material:       dv.material       ?? '',
      tipoTapete:     dv.tipoTapete     ?? [],
      extras:         dv.extras         ?? [],
      tipoClienteId:  dv.tipoClienteId  ?? '',
      quantidade:     dv.quantidade     ?? 1,
      maisInfo:       dv.maisInfo       ?? '',
      descontoManual: dv.descontoManual ?? 0,
      valor:          dv.valor          ?? 0,
      sinal:          dv.sinal          ?? 0,
      formaPagamento: dv.formaPagamento ?? '',
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

  useEffect(() => {
    setValue('valor', resultado.valorFinal)
  }, [resultado.valorFinal, setValue])

  async function onSubmit(data: FormValues) {
    try {
      const res = await fetch(`/api/pedidos/${pedidoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          matricula:         data.matricula,
          viatura:           data.viatura,
          ano:               data.ano,
          combustivel:       data.combustivel,
          material:          data.material,
          tipoTapete:        data.tipoTapete,
          extras:            data.extras,
          extrasQuantidades,
          quantidade:        data.quantidade,
          maisInfo:          data.maisInfo,
          tipoClienteId:     data.tipoClienteId,
          descontoManual:    data.descontoManual,
          valor:             data.valor,
          sinal:             data.sinal,
          formaPagamento:    data.formaPagamento,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.erro ?? 'Erro ao guardar')
      }

      router.push(`/${tenantSlug}/pedidos/${pedidoId}`)
      router.refresh()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao guardar pedido')
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

      {/* Cliente — apenas leitura */}
      <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
        <span className="text-xs text-slate-400 uppercase tracking-wide">Cliente</span>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-0.5">{clienteNome}</p>
      </div>

      {/* Matrícula */}
      <div>
        <label className={labelCls}>Matrícula</label>
        <Controller
          name="matricula"
          control={control}
          render={({ field }) => (
            <CampoMatricula
              value={field.value ?? ''}
              onChange={field.onChange}
              onViaturaChange={(viatura, ano, combustivel) => {
                setValue('viatura', viatura)
                setValue('ano', ano)
                setValue('combustivel', combustivel)
              }}
            />
          )}
        />
      </div>

      {/* Viatura + Ano + Combustível */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1">
          <label className={labelCls}>Viatura</label>
          <input {...register('viatura')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Ano</label>
          <input {...register('ano')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Combustível</label>
          <input {...register('combustivel')} className={inputCls} />
        </div>
      </div>

      {/* Material */}
      <div>
        <label className={labelCls}>Material <span className="text-red-500">*</span></label>
        <Controller
          name="material"
          control={control}
          render={({ field }) => (
            <CampoSelect
              value={field.value}
              onChange={field.onChange}
              opcoes={opcoesMaterial}
              labels={labelsDeCampo('material')}
              placeholder="Selecciona o material"
            />
          )}
        />
        {errors.material && <p className="mt-1 text-xs text-red-400">{errors.material.message}</p>}
      </div>

      {/* Tipo Tapete */}
      <div>
        <label className={labelCls}>Tipo Tapete <span className="text-red-500">*</span></label>
        <Controller
          name="tipoTapete"
          control={control}
          render={({ field }) => (
            <CampoMultiSelect
              value={field.value}
              onChange={field.onChange}
              opcoes={opcoesTipoTap}
            />
          )}
        />
        {errors.tipoTapete && <p className="mt-1 text-xs text-red-400">{errors.tipoTapete.message}</p>}
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
              opcoes={opcoesExtras}
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
        <label className={labelCls}>Tipo Cliente <span className="text-red-500">*</span></label>
        <Controller
          name="tipoClienteId"
          control={control}
          render={({ field }) => (
            <CampoSelect
              value={field.value}
              onChange={field.onChange}
              opcoes={config.tiposCliente.map(t => t.id)}
              labels={Object.fromEntries(
                config.tiposCliente.map(t => [
                  t.id,
                  `${t.nome}${t.descontoPct > 0 ? ` (−${t.descontoPct}%)` : ''}`,
                ])
              )}
              placeholder="Selecciona o tipo"
            />
          )}
        />
        {errors.tipoClienteId && <p className="mt-1 text-xs text-red-400">{errors.tipoClienteId.message}</p>}
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
        <textarea {...register('maisInfo')} rows={2} className={inputCls} />
      </div>

      {/* Resumo preço em tempo real */}
      <ResumoPreco resultado={resultado} />

      {/* Desconto manual + Sinal */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Desconto Manual (€)</label>
          <input
            {...register('descontoManual', { valueAsNumber: true })}
            type="number" min="0" step="0.01"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Sinal (€)</label>
          <input
            {...register('sinal', { valueAsNumber: true })}
            type="number" min="0" step="0.01"
            className={inputCls}
          />
        </div>
      </div>

      {/* Valor final */}
      <div>
        <label className={labelCls}>
          Valor Final (€)
          <span className="ml-2 text-xs text-slate-400 font-normal">
            calculado: {resultado.valorFinal.toFixed(2)}€
          </span>
        </label>
        <input
          {...register('valor', { valueAsNumber: true })}
          type="number" min="0" step="0.01"
          className={inputCls}
        />
      </div>

      {/* Forma de pagamento */}
      <div>
        <label className={labelCls}>Forma de Pagamento <span className="text-red-500">*</span></label>
        <Controller
          name="formaPagamento"
          control={control}
          render={({ field }) => (
            <CampoSelect
              value={field.value}
              onChange={field.onChange}
              opcoes={['PAGO', 'PAGAR_NA_ENTREGA', 'ENVIO_A_COBRANCA', 'TRANSFERENCIA']}
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
        {errors.formaPagamento && <p className="mt-1 text-xs text-red-400">{errors.formaPagamento.message}</p>}
      </div>

      {/* Botões */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 py-3 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 py-3 bg-gold text-slate-900 font-medium rounded-xl hover:bg-gold-dark disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? 'A guardar…' : 'Guardar alterações'}
        </button>
      </div>
    </form>
  )
}
