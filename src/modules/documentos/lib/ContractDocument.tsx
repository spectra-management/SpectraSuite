import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { CompanySettings } from '@/shared/types'

/**
 * Generic company-document PDF: company letterhead + centered title + body paragraphs.
 * Built with @react-pdf's built-in Helvetica (Latin-1 covers Spanish). Lazy-loaded by
 * the Generate page so the renderer chunk stays out of the initial bundle.
 *
 * `DocumentPage` can be composed many-per-Document for bulk generation (one page per
 * employee); `ContractDocument` wraps a single page for individual generation.
 */

export interface DocumentPageData {
  /** Already-filled title (variables resolved). */
  title: string
  /** Already-filled body; paragraphs separated by blank lines. */
  body: string
  /** Footer caption, e.g. employee name + generation date. */
  footer: string
}

const EMERALD = '#059669'
const INK = '#111827'
const MUTED = '#6B7280'

const styles = StyleSheet.create({
  page: {
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontSize: 10.5,
    lineHeight: 1.55,
    color: INK,
    fontFamily: 'Helvetica',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  logo: { width: 44, height: 44, objectFit: 'contain' },
  companyName: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: INK },
  companyMeta: { fontSize: 8.5, color: MUTED, marginTop: 1 },
  rule: { height: 2, backgroundColor: EMERALD, marginTop: 10, marginBottom: 22, borderRadius: 1 },
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    letterSpacing: 0.5,
    marginBottom: 18,
    color: INK,
  },
  paragraph: { marginBottom: 10, textAlign: 'justify' },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 56,
    right: 56,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
    fontSize: 8,
    color: MUTED,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})

function isRasterDataUri(src?: string): src is string {
  return !!src && (src.startsWith('data:image/png') || src.startsWith('data:image/jpeg') || src.startsWith('data:image/jpg'))
}

function paragraphsOf(body: string): string[] {
  // Blank line(s) separate paragraphs; single newlines are kept inside a paragraph.
  return body.split(/\n{2,}/).map((p) => p.replace(/^\n+|\n+$/g, '')).filter((p) => p.length > 0)
}

export function DocumentPage({ data, company }: { data: DocumentPageData; company: CompanySettings }) {
  return (
    <Page size="A4" style={styles.page}>
      <View style={styles.header}>
        {isRasterDataUri(company.logoBase64) && <Image src={company.logoBase64} style={styles.logo} />}
        <View>
          <Text style={styles.companyName}>{company.name}</Text>
          {!!company.rnc && <Text style={styles.companyMeta}>RNC: {company.rnc}</Text>}
          {!!company.address && <Text style={styles.companyMeta}>{company.address}</Text>}
          {!!company.phone && <Text style={styles.companyMeta}>{company.phone}</Text>}
        </View>
      </View>
      <View style={styles.rule} />

      <Text style={styles.title}>{data.title}</Text>

      {paragraphsOf(data.body).map((p, i) => (
        <Text key={i} style={styles.paragraph}>{p}</Text>
      ))}

      <View style={styles.footer} fixed>
        <Text>{data.footer}</Text>
        <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
      </View>
    </Page>
  )
}

/** Single-page document (individual generation). */
export function ContractDocument({ data, company }: { data: DocumentPageData; company: CompanySettings }) {
  return (
    <Document>
      <DocumentPage data={data} company={company} />
    </Document>
  )
}

/** Multi-page document — one page per employee (bulk generation, single file). */
export function BulkDocument({ pages, company }: { pages: DocumentPageData[]; company: CompanySettings }) {
  return (
    <Document>
      {pages.map((data, i) => (
        <DocumentPage key={i} data={data} company={company} />
      ))}
    </Document>
  )
}
