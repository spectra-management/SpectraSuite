import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { ResolvedBaseballCard } from '@/shared/lib/baseballCard'

/**
 * Employee "baseball card" PDF — landscape card with the Spectra letterhead, a left column
 * of profile fields and a right column with the photo + a Goals box. Built with @react-pdf's
 * built-in Helvetica (Latin-1 covers EN/ES). Lazy-loaded by the Baseball Card tab.
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
const INK = '#111827'
const BORDER = '#1f2937'

const styles = StyleSheet.create({
  page: { padding: 22, fontSize: 9, color: INK, fontFamily: 'Helvetica', backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 },
  logo: { width: 28, height: 28, objectFit: 'contain' },
  brand: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: INK },
  brandThin: { fontSize: 18, color: EMERALD },
  body: { flexDirection: 'row', gap: 12, flexGrow: 1 },
  leftBox: { flex: 2, borderWidth: 1, borderColor: '#9ca3af', borderRadius: 4, padding: 12 },
  rightCol: { flex: 1, gap: 12 },
  photo: { width: '100%', height: 150, objectFit: 'cover', borderRadius: 4 },
  photoFallback: {
    width: '100%', height: 150, borderRadius: 4, backgroundColor: '#d1fae5',
    alignItems: 'center', justifyContent: 'center',
  },
  photoInitials: { fontSize: 36, fontFamily: 'Helvetica-Bold', color: EMERALD },
  goalsBox: { borderWidth: 1, borderColor: BORDER, borderRadius: 4, padding: 10 },
  goalsTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'center', marginBottom: 6 },
  row: { marginBottom: 8 },
  inline: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  label: { fontFamily: 'Helvetica-Bold', color: INK },
  value: { color: INK },
  sectionLabel: { fontFamily: 'Helvetica-Bold', color: INK, marginBottom: 2 },
  bullet: { flexDirection: 'row', gap: 4, marginBottom: 1.5 },
  bulletDot: { color: INK },
  bulletText: { flex: 1, color: INK },
  goalBullet: { flexDirection: 'row', gap: 4, marginBottom: 4 },
})

function Labeled({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <Text style={styles.value}>
      <Text style={styles.label}>{label}: </Text>
      {value}
    </Text>
  )
}

function Bullets({ label, items }: { label?: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <View style={styles.row}>
      {label ? <Text style={styles.sectionLabel}>{label}:</Text> : null}
      {items.map((it, i) => (
        <View key={i} style={styles.bullet}>
          <Text style={styles.bulletDot}>•</Text>
          <Text style={styles.bulletText}>{it}</Text>
        </View>
      ))}
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
  return (
    <Document>
      <Page size={[780, 440]} orientation="landscape" style={styles.page}>
        {/* Letterhead */}
        <View style={styles.header}>
          {logoSrc ? <Image src={logoSrc} style={styles.logo} /> : null}
          <Text style={styles.brand}>{companyName}</Text>
        </View>

        <View style={styles.body}>
          {/* Left: fields */}
          <View style={styles.leftBox}>
            <View style={styles.row}>
              <View style={styles.inline}>
                <Labeled label={labels.fullName} value={card.fullName} />
                <Labeled label={labels.nickName} value={card.nickName} />
              </View>
            </View>

            <View style={styles.row}>
              <Labeled label={labels.dob} value={card.dobMonthDay} />
            </View>

            <View style={styles.row}>
              <Labeled label={labels.spectraStart} value={card.spectraStartDate} />
              <View style={styles.inline}>
                <Labeled label={labels.accountName} value={card.accountName} />
                <Labeled label={labels.accountStart} value={card.accountStartDate} />
              </View>
              <Labeled label={labels.jobTitle} value={card.jobTitle} />
            </View>

            <Bullets label={labels.jobHistory} items={card.jobHistory} />
            <View style={styles.row}>
              <Labeled label={labels.education} value={card.education} />
            </View>
            <View style={styles.row}>
              <Labeled label={labels.hobbies} value={card.hobbies.join(', ')} />
            </View>
            <View style={styles.row}>
              <Labeled label={labels.funFacts} value={card.funFacts.join(', ')} />
            </View>
            <View style={styles.row}>
              <Labeled label={labels.leadershipStyle} value={card.leadershipStyle} />
            </View>
          </View>

          {/* Right: photo + goals */}
          <View style={styles.rightCol}>
            {photoSrc ? (
              <Image src={photoSrc} style={styles.photo} />
            ) : (
              <View style={styles.photoFallback}>
                <Text style={styles.photoInitials}>{initials}</Text>
              </View>
            )}
            {card.goals.length > 0 ? (
              <View style={styles.goalsBox}>
                <Text style={styles.goalsTitle}>{labels.goals}:</Text>
                {card.goals.map((g, i) => (
                  <View key={i} style={styles.goalBullet}>
                    <Text style={styles.bulletDot}>•</Text>
                    <Text style={styles.bulletText}>{g}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      </Page>
    </Document>
  )
}
