import { CritiqueReportSchema, calculateQualityScore, type CritiqueReport, type Issue } from './lib/types/critique-report'

// Test 1: Validate complete CritiqueReport object
console.log('Test 1: Complete CritiqueReport with all fields')
const completeReport: CritiqueReport = {
  criticalIssues: [
    {
      fieldPath: '$.dataEntities[2]',
      issueType: 'missing_definition',
      severity: 'critical',
      description: 'Order entity referenced but not defined',
      recommendation: 'Add Order entity to dataEntities',
    },
  ],
  warnings: [
    {
      fieldPath: '$.userRoles',
      issueType: 'role_mismatch',
      severity: 'warning',
      description: 'Flow references "manager" role not in userRoles',
      recommendation: 'Add "manager" to userRoles array',
    },
  ],
  suggestions: [
    {
      fieldPath: '$.coreFlows',
      issueType: 'inconsistent_reference',
      severity: 'info',
      description: 'Consider adding error handling flow',
      recommendation: 'Document error scenarios',
    },
  ],
  overallAssessment: 'Specification has 1 critical issue that must be resolved',
  passesValidation: false,
  qualityScore: 75,
  createdAt: Date.now(),
  modelUsed: 'anthropic/claude-3.5-sonnet',
}

try {
  const parsed = CritiqueReportSchema.parse(completeReport)
  console.log('✓ Complete report validated successfully')
  console.log(`  Critical Issues: ${parsed.criticalIssues.length}`)
  console.log(`  Warnings: ${parsed.warnings.length}`)
  console.log(`  Suggestions: ${parsed.suggestions.length}`)
  console.log(`  Quality Score: ${parsed.qualityScore}`)
} catch (error) {
  console.error('✗ Validation failed:', error)
  process.exit(1)
}

// Test 2: Validate minimal CritiqueReport (arrays should default to empty)
console.log('\nTest 2: Minimal CritiqueReport with default arrays')
const minimalInput = {
  overallAssessment: 'Specification looks good',
  passesValidation: true,
  qualityScore: 100,
  createdAt: Date.now(),
  modelUsed: 'test/model',
}

try {
  const parsed = CritiqueReportSchema.parse(minimalInput)
  console.log('✓ Minimal report validated successfully')
  console.log(`  Critical Issues: ${parsed.criticalIssues.length} (should be 0)`)
  console.log(`  Warnings: ${parsed.warnings.length} (should be 0)`)
  console.log(`  Suggestions: ${parsed.suggestions.length} (should be 0)`)
  if (parsed.criticalIssues.length !== 0 || parsed.warnings.length !== 0 || parsed.suggestions.length !== 0) {
    throw new Error('Arrays should default to empty')
  }
} catch (error) {
  console.error('✗ Validation failed:', error)
  process.exit(1)
}

// Test 3: Quality score calculation
console.log('\nTest 3: Quality score calculation')
const testReport: CritiqueReport = {
  criticalIssues: [
    {
      fieldPath: '$.test1',
      issueType: 'missing_definition',
      severity: 'critical',
      description: 'Test critical',
      recommendation: 'Fix it',
    },
  ],
  warnings: [
    {
      fieldPath: '$.test2',
      issueType: 'role_mismatch',
      severity: 'warning',
      description: 'Test warning',
      recommendation: 'Fix it',
    },
    {
      fieldPath: '$.test3',
      issueType: 'auth_inconsistency',
      severity: 'warning',
      description: 'Test warning 2',
      recommendation: 'Fix it',
    },
  ],
  suggestions: [
    {
      fieldPath: '$.test4',
      issueType: 'inconsistent_reference',
      severity: 'info',
      description: 'Test suggestion',
      recommendation: 'Consider it',
    },
  ],
  overallAssessment: 'Test',
  passesValidation: false,
  qualityScore: 0,
  createdAt: Date.now(),
  modelUsed: 'test',
}

const calculatedScore = calculateQualityScore(testReport)
const expectedScore = 100 - (1 * 20) - (2 * 5) - (1 * 1) // 100 - 20 - 10 - 1 = 69
console.log(`  Calculated Score: ${calculatedScore}`)
console.log(`  Expected Score: ${expectedScore}`)
if (calculatedScore !== expectedScore) {
  console.error(`✗ Quality score calculation incorrect. Expected ${expectedScore}, got ${calculatedScore}`)
  process.exit(1)
}
console.log('✓ Quality score calculation correct')

// Test 4: JSONPath format validation
console.log('\nTest 4: JSONPath format in fieldPath')
const jsonPathTests = [
  '$.dataEntities[0]',
  '$.coreFlows[3].name',
  '$.userRoles',
  '$.suggestedFeatures[1].enabled',
  '$.dataEntities[0].fields[2]',
]

for (const path of jsonPathTests) {
  const issue: Issue = {
    fieldPath: path,
    issueType: 'inconsistent_reference',
    severity: 'warning',
    description: 'Test issue',
    recommendation: 'Fix it',
  }
  try {
    CritiqueReportSchema.parse({
      criticalIssues: [issue],
      overallAssessment: 'Test',
      passesValidation: false,
      qualityScore: 80,
      createdAt: Date.now(),
      modelUsed: 'test',
    })
    console.log(`  ✓ JSONPath accepted: ${path}`)
  } catch (error) {
    console.error(`  ✗ JSONPath rejected: ${path}`)
    process.exit(1)
  }
}

// Test 5: Round-trip serialization
console.log('\nTest 5: Round-trip serialization')
const originalReport = completeReport
const serialized = JSON.stringify(originalReport)
const deserialized = JSON.parse(serialized)
try {
  const reparsed = CritiqueReportSchema.parse(deserialized)
  console.log('✓ Round-trip serialization successful')
  console.log(`  Original quality score: ${originalReport.qualityScore}`)
  console.log(`  Reparsed quality score: ${reparsed.qualityScore}`)
} catch (error) {
  console.error('✗ Round-trip failed:', error)
  process.exit(1)
}

// Test 6: All issue types
console.log('\nTest 6: All issue types are valid')
const issueTypes = [
  'missing_definition',
  'inconsistent_reference',
  'circular_dependency',
  'stack_violation',
  'role_mismatch',
  'auth_inconsistency',
] as const

for (const issueType of issueTypes) {
  try {
    CritiqueReportSchema.parse({
      criticalIssues: [{
        fieldPath: '$.test',
        issueType,
        severity: 'warning',
        description: `Test ${issueType}`,
        recommendation: 'Fix it',
      }],
      overallAssessment: 'Test',
      passesValidation: false,
      qualityScore: 80,
      createdAt: Date.now(),
      modelUsed: 'test',
    })
    console.log(`  ✓ Issue type accepted: ${issueType}`)
  } catch (error) {
    console.error(`  ✗ Issue type rejected: ${issueType}`)
    process.exit(1)
  }
}

console.log('\n✓ All tests passed!')
