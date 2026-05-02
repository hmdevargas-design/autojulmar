# 🎯 DESIGN SYSTEM — TAPETES AUTOMOTIVOS PERSONALIZADOS

> **Autojulmar · Loures, Portugal**
> Versão 1.0 · Maio 2026

---

## 🧠 VISÃO DA MARCA

**Posicionamento:**
Loja especializada em tapetes automotivos personalizados com estética premium.

**Percepção desejada:**
- Sofisticação
- Precisão
- Personalização
- Confiança

---

## 🎨 PALETA DE CORES

### 🖤 Base (estrutura)

| Nome           | HEX       | Uso                           |
|----------------|-----------|-------------------------------|
| Preto Profundo | `#0D0D0D` | Fundo principal, paredes      |
| Preto Suave    | `#1A1A1A` | Superfícies secundárias       |
| Grafite        | `#2A2A2A` | Apoio visual / contraste      |

### ✨ Destaque (premium)

| Nome              | HEX       | Uso                            |
|-------------------|-----------|--------------------------------|
| Dourado Principal | `#C8A96A` | Detalhes, iluminação, foco     |
| Dourado Escuro    | `#8C6B3F` | Profundidade / variações       |

### 🌈 Cores de Rebordo (personalização)

| Cor      | HEX       |
|----------|-----------|
| Vermelho | `#D62828` |
| Azul     | `#1D4ED8` |
| Amarelo  | `#FBBF24` |
| Verde    | `#16A34A` |
| Laranja  | `#F97316` |
| Branco   | `#E5E5E5` |
| Cinza    | `#6B7280` |

### ⚠️ Regras de Cor

- Base **sempre escura**
- Dourado usado **com moderação** — é o elemento nobre, não o dominante
- Cores vibrantes apenas como **destaque pontual**
- Nunca misturar muitas cores no mesmo espaço

---

## 🔤 TIPOGRAFIA

### Títulos
- **Famílias:** Montserrat · Poppins · Oswald
- **Estilo:** CAIXA ALTA (UPPERCASE)
- **Tracking:** espaçamento leve entre letras (`letter-spacing: 0.08em`)
- **Peso:** Bold (700) ou ExtraBold (800)

### Textos de suporte
- Fonte limpa e sem serifa
- Peso Regular ou Medium
- Evitar excesso de texto — menos é mais

### Hierarquia sugerida (web/digital)

| Nível     | Tamanho | Peso   | Estilo            |
|-----------|---------|--------|-------------------|
| H1        | 48–64px | 800    | Uppercase, dourado |
| H2        | 32–40px | 700    | Uppercase, branco  |
| H3        | 24px    | 600    | Normal, branco     |
| Body      | 16px    | 400    | Cinza claro        |
| Label     | 12px    | 500    | Uppercase, tracking largo |

---

## 💡 ILUMINAÇÃO

### Temperatura
- **2700K – 3000K** (luz quente / âmbar)

### Tipos
- **Spots direcionáveis** → destacar produto individualmente
- **LED embutido (linear)** → contorno, rodapé e balcão

### Regra de Ouro
> A luz deve destacar o **produto**, não o ambiente.
> O espaço serve de palco — o tapete é o protagonista.

---

## 🧱 MATERIAIS E ACABAMENTOS

### Estrutura
- **MDF preto fosco** — paredes, painéis, balcão
- **Metal preto** — estruturas, suportes, divisórias
- **OSB** — uso controlado e com propósito visual (textura industrial)

### Princípio de Acabamento
- Fosco sempre preferível ao brilhante
- Acabamento limpo e uniforme
- Sem imperfeições visíveis — o detalhe transmite qualidade

---

## 🧩 COMPONENTES DE LOJA

### 🔲 Painel de Tapetes (Linha Premium)
- Fundo preto fosco
- Organização em grade regular
- Iluminação superior directa
- Etiqueta dourada com nome do material

### 🌈 Painel de Cores de Rebordo
- Disposição horizontal, da esquerda para a direita
- Ordenação por tonalidade / família de cor
- Iluminação directa para fidelidade de cor

### 🧵 Painel de Bordados Personalizados
- Mini-tapetes reais como amostras
- Nome bordado em destaque (Sport, Elite, Urban, Racing…)
- Máximo 9 opções por painel
- Cores de texto contrastantes com o fundo do tapete

### 🧾 Balcão de Atendimento
- Estrutura escura, linhas limpas
- Iluminação frontal em LED dourado
- Superfície de trabalho organizada — sem objectos desnecessários à vista
- Logo da loja centrado na frente do balcão

---

## 💬 TOM DE COMUNICAÇÃO

### Estilo
- Directo
- Confiante
- Sem excesso — cada palavra tem peso

### Frases Padrão da Marca
- *"Feito à medida."*
- *"Detalhes que fazem a diferença."*
- *"Seu carro, seu estilo."*
- *"Na hora. Do seu jeito."*

### Tom por Canal

| Canal        | Tom                              |
|--------------|----------------------------------|
| WhatsApp     | Informal, rápido, directo        |
| Instagram    | Visual em primeiro lugar, copy curto |
| Loja física  | Atencioso, especialista, sem pressão |
| Orçamentos   | Claro, preciso, sem ambiguidade  |

---

## 📱 REDES SOCIAIS

### Estética Visual
- Fundo sempre escuro
- Produto como elemento central e bem iluminado
- Paleta restrita: preto + dourado + cor do tapete
- Poucos elementos por imagem — respiração visual

### Tipos de Conteúdo
- **Antes / Depois** — impacto imediato
- **Close-up de acabamentos** — rebordo, bordado, material
- **Personalização em processo** — bastidores da produção
- **Depoimentos com foto do carro** — prova social real

### Regras de Post
- Sem marcas d'água pesadas
- Legenda curta + emojis com moderação
- Hashtags no comentário, não na legenda

---

## 🚫 O QUE EVITAR

| Proibido                         | Porquê                            |
|----------------------------------|-----------------------------------|
| Poluição visual                  | Dilui o foco no produto           |
| Muitas cores num mesmo espaço    | Contradiz o posicionamento premium|
| Mistura de estilos               | Quebra a identidade da marca      |
| Excesso de informação            | Confunde e atrasa a decisão       |
| Fundos brancos ou claros         | Opostos ao posicionamento         |
| Tipografia decorativa / script   | Perde legibilidade e seriedade    |

---

## 🏗️ APLICAÇÕES DIGITAIS (Web / App)

### CSS Variables (referência)

```css
:root {
  /* Base */
  --color-bg-primary:    #0D0D0D;
  --color-bg-secondary:  #1A1A1A;
  --color-bg-tertiary:   #2A2A2A;

  /* Destaque */
  --color-gold-primary:  #C8A96A;
  --color-gold-dark:     #8C6B3F;

  /* Texto */
  --color-text-primary:  #E5E5E5;
  --color-text-muted:    #6B7280;

  /* Cores de Rebordo */
  --color-accent-red:    #D62828;
  --color-accent-blue:   #1D4ED8;
  --color-accent-yellow: #FBBF24;
  --color-accent-green:  #16A34A;
  --color-accent-orange: #F97316;

  /* Tipografia */
  --font-heading: 'Montserrat', 'Poppins', sans-serif;
  --font-body:    'Inter', 'Poppins', sans-serif;

  /* Espaçamentos base */
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   16px;
}
```

---

## 🚀 DIREÇÃO ESTRATÉGICA

Este design system deve garantir que:

1. **Tudo pareça parte da mesma marca** — do WhatsApp ao Instagram à loja física
2. **O cliente perceba valor imediatamente** — sem precisar de explicação
3. **O ambiente venda por si só** — a experiência é parte do produto
4. **A consistência construa confiança** — cada touchpoint reforça o posicionamento

---

## ✨ RESUMO DE PRINCÍPIOS

> **Menos, porém melhor.**
> **Escuro, porém sofisticado.**
> **Simples, porém premium.**

---

*Design System · Autojulmar · Tapetes Automotivos Personalizados*
*Loures, Portugal · v1.0 · Maio 2026*
