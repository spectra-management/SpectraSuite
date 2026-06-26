import type { ReactNode } from 'react'
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { ResolvedBaseballCard } from '@/shared/lib/baseballCard'

/**
 * Employee "baseball card" PDF — a premium landscape card on Spectra's emerald/white system.
 *
 * Layout: a full-height EMERALD sidebar (logo, framed photo, identity + key facts) and a white
 * main panel of sections with emerald accent labels and a highlighted Goals box. Built with
 * @react-pdf's Helvetica (Latin-1 covers EN/ES); depth comes from fills + accent bars + borders
 * (react-pdf has no box-shadow). Lazy-loaded by the Baseball Card tab.
 */

export interface BaseballCardLabels {
  fullName: string
  nickName: string
  dob: string
  spectraStart: string
  accountName: string
  accountStart: string
  jobTitle: string
  jobHistory: string
  education: string
  hobbies: string
  funFacts: string
  leadershipStyle: string
  goals: string
}

const EMERALD = '#059669'
const EMERALD_DARK = '#047857'
const EMERALD_50 = '#ECFDF5'
const EMERALD_100 = '#D1FAE5'
const EMERALD_700 = '#047857'
const INK = '#111827'
const WHITE = '#FFFFFF'

const styles = StyleSheet.create({
  page: { flexDirection: 'row', fontFamily: 'Helvetica', color: INK, backgroundColor: WHITE },

  // ── Left emerald sidebar ──
  sidebar: { width: '36%', backgroundColor: EMERALD, padding: 20, color: WHITE },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  logoChip: { backgroundColor: WHITE, borderRadius: 6, padding: 4 },
  logo: { width: 18, height: 18, objectFit: 'contain' },
  brand: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: WHITE, letterSpacing: 0.3 },
  photoFrame: { backgroundColor: WHITE, borderRadius: 10, padding: 3, marginBottom: 12 },
  photo: { width: '100%', height: 150, objectFit: 'cover', borderRadius: 7 },
  photoFallback: {
    width: '100%', height: 150, borderRadius: 7, backgroundColor: EMERALD_DARK,
    alignItems: 'center', justifyContent: 'center',
  },
  photoInitials: { fontSize: 40, fontFamily: 'Helvetica-Bold', color: WHITE },
  name: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: WHITE, lineHeight: 1.15 },
  nick: { fontSize: 10, color: EMERALD_100, marginTop: 1 },
  jobTitle: { fontSize: 9.5, color: EMERALD_100, marginTop: 4 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.3)', marginVertical: 12 },
  factLabel: { fontSize: 6.5, fontFamily: 'Helvetica-Bold', color: EMERALD_100, letterSpacing: 1, textTransform: 'uppercase' },
  factValue: { fontSize: 9.5, color: WHITE, marginBottom: 8 },

  // ── Right white panel ──
  main: { flex: 1, padding: 22 },
  section: { marginBottom: 11 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 4 },
  accentBar: { width: 3, height: 9, backgroundColor: EMERALD, borderRadius: 2 },
  sectionLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: EMERALD_700, letterSpacing: 0.8, textTransform: 'uppercase' },
  body: { fontSize: 9.5, color: INK, lineHeight: 1.4 },
  bullet: { flexDirection: 'row', gap: 5, marginBottom: 2 },
  bulletDot: { color: EMERALD, fontFamily: 'Helvetica-Bold' },
  bulletText: { flex: 1, fontSize: 9.5, color: INK, lineHeight: 1.35 },
  twoCol: { flexDirection: 'row', gap: 16 },
  col: { flex: 1 },

  goalsBox: { backgroundColor: EMERALD_50, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: EMERALD, padding: 10, marginTop: 2 },
  goalsTitle: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: EMERALD_700, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 5 },
})

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.accentBar} />
        <Text style={styles.sectionLabel}>{label}</Text>
      </View>
      {children}
    </View>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <View>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  )
}

export function BaseballCardDocument({
  card,
  labels,
  companyName,
  logoSrc,
  photoSrc,
  initials,
}: {
  card: ResolvedBaseballCard
  labels: BaseballCardLabels
  companyName: string
  logoSrc?: string
  photoSrc?: string
  initials: string
}) {
  const accountLine = [card.accountName, card.accountStartDate].filter(Boolean).join('  ·  ')
  return (
    <Document>
      <Page size={[780, 440]} orientation="landscape" style={styles.page}>
        {/* Emerald sidebar */}
        <View style={styles.sidebar}>
          <View style={styles.brandRow}>
            {logoSrc ? (
              <View style={styles.logoChip}><Image src={logoSrc} style={styles.logo} /></View>
            ) : null}
            <Text style={styles.brand}>{companyName}</Text>
          </View>

          <View style={styles.photoFrame}>
            {photoSrc ? (
              <Image src={photoSrc} style={styles.photo} />
            ) : (
              <View style={styles.photoFallback}><Text style={styles.photoInitials}>{initials}</Text></View>
            )}
          </View>

          <Text style={styles.name}>{card.fullName}</Text>
          {card.nickName ? <Text style={styles.nick}>“{card.nickName}”</Text> : null}
          {card.jobTitle ? <Text style={styles.jobTitle}>{card.jobTitle}</Text> : null}

          <View style={styles.divider} />

          <Fact label={labels.dob} value={card.dobMonthDay} />
          <Fact label={labels.spectraStart} value={card.spectraStartDate} />
          <Fact label={labels.accountName} value={accountLine} />
        </View>

        {/* White main panel */}
        <View style={styles.main}>
          {card.jobHistory.length > 0 && (
            <Section label={labels.jobHistory}>
              {card.jobHistory.map((j, i) => (
                <View key={i} style={styles.bullet}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{j}</Text>
                </View>
              ))}
            </Section>
          )}

          {card.education ? (
            <Section label={labels.education}><Text style={styles.body}>{card.education}</Text></Section>
          ) : null}

          <View style={styles.twoCol}>
            {card.hobbies.length > 0 && (
              <View style={styles.col}>
                <Section label={labels.hobbies}><Text style={styles.body}>{card.hobbies.join(', ')}</Text></Section>
              </View>
            )}
            {card.leadershipStyle ? (
              <View style={styles.col}>
                <Section label={labels.leadershipStyle}><Text style={styles.body}>{card.leadershipStyle}</Text></Section>
              </View>
            ) : null}
          </View>

          {card.funFacts.length > 0 && (
            <Section label={labels.funFacts}><Text style={styles.body}>{card.funFacts.join(', ')}</Text></Section>
          )}

          {card.goals.length > 0 && (
            <View style={styles.goalsBox}>
              <Text style={styles.goalsTitle}>{labels.goals}</Text>
              {card.goals.map((g, i) => (
                <View key={i} style={styles.bullet}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{g}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </Page>
    </Document>
  )
}
