import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'

const projectId = 'demo-asg-leads-map'
let environment: RulesTestEnvironment

const lead = (officeId = 'perth') => ({ officeId, leadName: 'Ava', address: '1 Main St' })

async function seed() {
  await environment.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await Promise.all([
      setDoc(doc(db, 'users', 'rep-perth'), { active: true, role: 'rep', officeId: 'perth' }),
      setDoc(doc(db, 'users', 'rep-brisbane'), { active: true, role: 'rep', officeId: 'brisbane' }),
      setDoc(doc(db, 'users', 'inactive'), { active: false, role: 'rep', officeId: 'perth' }),
      setDoc(doc(db, 'users', 'super-admin'), { active: true, role: 'super_admin', officeId: 'perth' }),
      setDoc(doc(db, 'leads', 'existing-perth'), lead('perth')),
      setDoc(doc(db, 'leads', 'existing-brisbane'), lead('brisbane')),
      setDoc(doc(db, 'leads', 'source-perth'), { ...lead('perth'), source: { spreadsheetId: 'trusted-sheet' } }),
    ])
  })
}

beforeAll(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: { rules: readFileSync('firestore.rules', 'utf8') },
  })
})

beforeEach(async () => {
  await environment.clearFirestore()
  await seed()
})

afterAll(async () => {
  await environment.cleanup()
})

describe('Firestore lead security rules', () => {
  it('denies signed-out and inactive users', async () => {
    const signedOut = environment.unauthenticatedContext().firestore()
    const inactive = environment.authenticatedContext('inactive').firestore()

    await assertFails(getDoc(doc(signedOut, 'leads', 'existing-perth')))
    await assertFails(setDoc(doc(signedOut, 'leads', 'signed-out-create'), lead('perth')))
    await assertFails(getDoc(doc(inactive, 'leads', 'existing-perth')))
    await assertFails(setDoc(doc(inactive, 'leads', 'inactive-create'), lead('perth')))
  })

  it('allows active users to read and write within their assigned office', async () => {
    const db = environment.authenticatedContext('rep-perth').firestore()

    await assertSucceeds(getDoc(doc(db, 'leads', 'existing-perth')))
    await assertSucceeds(setDoc(doc(db, 'leads', 'new-perth'), lead('perth')))
    await assertSucceeds(updateDoc(doc(db, 'leads', 'existing-perth'), { leadName: 'Ava Updated' }))
    await assertSucceeds(updateDoc(doc(db, 'leads', 'source-perth'), { leadName: 'Operational edit' }))
  })

  it('denies cross-office reads and writes', async () => {
    const db = environment.authenticatedContext('rep-perth').firestore()

    await assertFails(getDoc(doc(db, 'leads', 'existing-brisbane')))
    await assertFails(setDoc(doc(db, 'leads', 'new-brisbane'), lead('brisbane')))
  })

  it('allows active super admins across offices', async () => {
    const db = environment.authenticatedContext('super-admin').firestore()

    await assertSucceeds(getDoc(doc(db, 'leads', 'existing-brisbane')))
    await assertSucceeds(setDoc(doc(db, 'leads', 'new-brisbane'), lead('brisbane')))
    await assertFails(setDoc(doc(db, 'leads', 'admin-source'), { ...lead('brisbane'), source: { forged: true } }))
    await assertSucceeds(updateDoc(doc(db, 'leads', 'existing-brisbane'), { leadName: 'Updated by admin' }))
    await assertFails(updateDoc(doc(db, 'leads', 'existing-brisbane'), { officeId: 'perth' }))
    await assertFails(updateDoc(doc(db, 'leads', 'existing-brisbane'), { source: { forged: true } }))
  })

  it('keeps officeId immutable and rejects source metadata from clients', async () => {
    const db = environment.authenticatedContext('rep-perth').firestore()

    await assertFails(updateDoc(doc(db, 'leads', 'existing-perth'), { officeId: 'brisbane' }))
    await assertFails(setDoc(doc(db, 'leads', 'client-source'), { ...lead(), source: { spreadsheetId: 'forged' } }))
    await assertFails(updateDoc(doc(db, 'leads', 'existing-perth'), { source: { spreadsheetId: 'forged' } }))
  })
})
