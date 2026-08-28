# Requirements Document

## Introduction

This document specifies requirements for migrating MirrorSite AI from a monolithic generation pipeline to a Progressive Generation Architecture. The current system clones websites into editable React code but suffers from poor time-to-first-pixel (80-170s), no progress feedback, and catastrophic failure modes where a single error forces full regeneration. The progressive architecture introduces 5 phases: Analyze → Instant Preview → Progressive Cloning → Validate → Polish, dramatically improving user experience through incremental delivery and targeted error recovery.

## Glossary

- **Generation_Pipeline**: The system that converts scraped website content into runnable React code
- **Site_Blueprint**: Structured JSON metadata extracted during analysis phase containing sections, colors, typography, and images
- **Sandbox**: An isolated execution environment (E2B or Vercel) where generated code runs
- **Phase**: A discrete stage of the progressive generation process (Analyze, Instant Preview, Progressive Cloning, Validate, Polish)
- **Section**: A logical UI component of the cloned website (header, hero, features, pricing, footer, etc.)
- **Hot_Reload**: Vite's fast refresh mechanism that updates the preview without full dev server restart
- **Monolithic_Generation**: The current single-pass architecture where all code must generate before any is applied
- **AI_SDK**: Vercel AI SDK used for streaming AI generation responses
- **Firecrawl**: Service used for web scraping and content extraction
- **Time_to_First_Pixel**: Elapsed time from generation start until user sees visual preview

## Requirements

### Requirement 1: Phase 1 — Site Analysis

**User Story:** As a user cloning a website, I want the system to analyze the site structure first, so that generation can be broken into logical sections

#### Acceptance Criteria

1. WHEN scraped content is provided, THE Generation_Pipeline SHALL extract section metadata using AI analysis within 10 seconds for typical websites containing 5 to 10 sections
2. THE Analysis_Phase SHALL identify section types from the set (header, hero, features, pricing, footer) with their sequential order
3. THE Analysis_Phase SHALL extract a color palette containing 3 to 10 distinct colors from scraped HTML and CSS
4. THE Analysis_Phase SHALL extract typography information including font family names, font weights (100 to 900), and font sizes in pixels or rem units
5. THE Analysis_Phase SHALL extract image URLs with their associated alt text and placement context indicating which section contains each image
6. WHEN analysis completes AND the resulting Site_Blueprint is successfully serialized to JSON, THE Analysis_Phase SHALL mark the phase as complete and produce the Site_Blueprint in JSON format
7. THE Site_Blueprint SHALL contain only metadata fields (sections, colors, typography, images) and SHALL NOT contain generated React code
8. IF scraped content is malformed or unparseable, THEN THE Analysis_Phase SHALL return an error message indicating the specific parsing failure
9. IF AI analysis fails to complete within 25 seconds, THEN THE Analysis_Phase SHALL timeout and return an error indicating analysis timeout

### Requirement 2: Phase 2 — Instant Preview Generation

**User Story:** As a user waiting for a clone, I want to see a working preview in 20-30 seconds, so that I know generation is progressing

#### Acceptance Criteria

1. WHEN the Site_Blueprint is available, THE Generation_Pipeline SHALL create a Sandbox if one does not exist
2. THE Instant_Preview_Phase SHALL generate a complete minimal layout from the Site_Blueprint
3. THE Generated_Layout SHALL include all sections in correct order with placeholder content
4. THE Generated_Layout SHALL apply base design system from color palette and typography
5. THE Instant_Preview_Phase SHALL write all layout files to the Sandbox
6. THE Instant_Preview_Phase SHALL install baseline packages (react, react-dom, tailwindcss)
7. THE Instant_Preview_Phase SHALL start the Vite dev server
8. THE Instant_Preview_Phase SHALL display the preview iframe within 20-30 seconds from generation start
9. THE Instant_Preview_Phase SHALL display the preview iframe immediately regardless of errors, and SHALL fix any errors in the background after the preview is shown

### Requirement 3: Phase 3 — Progressive Section Cloning

**User Story:** As a user watching generation, I want sections to fill in progressively with real content, so that I can see tangible progress

#### Acceptance Criteria

1. THE Progressive_Cloning_Phase SHALL classify Site_Blueprint sections into priority tiers: hero (highest), primary (features, pricing, services, products), secondary (testimonials, team, gallery, blog), footer (lowest)
2. THE Progressive_Cloning_Phase SHALL rank sections within each tier by their order in the Site_Blueprint
3. FOR EACH section in priority order, THE Progressive_Cloning_Phase SHALL generate content using scraped data from the original site and styling matching the Site_Blueprint
4. WHEN section generation completes, THE Progressive_Cloning_Phase SHALL write only the files associated with that section to the Sandbox
5. IF section generation exceeds 45 seconds, THEN THE Progressive_Cloning_Phase SHALL mark that section as failed and continue to the next section
6. WHEN files are written, THE Progressive_Cloning_Phase SHALL trigger Vite Hot_Reload without full dev server restart
7. IF Hot_Reload does not update the preview within 5 seconds, THEN THE Progressive_Cloning_Phase SHALL retry Hot_Reload once
8. IF Hot_Reload retry fails within 5 seconds, THEN THE Progressive_Cloning_Phase SHALL fall back to full dev server restart for that section
9. THE Progressive_Cloning_Phase SHALL emit progress events containing section name and status where status is one of: pending, generating, complete, failed
10. THE UI SHALL display progress indicators showing which sections are complete
11. THE Progressive_Cloning_Phase SHALL continue until all Site_Blueprint sections are processed
12. WHEN dev server restart completes, THE Progressive_Cloning_Phase SHALL verify the preview loads within 10 seconds before continuing to the next section

### Requirement 4: Phase 4 — Build Validation

**User Story:** As a system ensuring quality, I want build errors caught and fixed automatically, so that users receive working code

#### Acceptance Criteria

1. WHEN all sections are cloned, THE Validation_Phase SHALL run a build check using the project's configured build command
2. IF the build check completes with exit code 0, THEN THE Validation_Phase SHALL mark validation as successful
3. IF build errors are detected, THEN THE Validation_Phase SHALL extract failing file paths and error messages from the build output
4. IF a single file fails the build check, THEN THE Validation_Phase SHALL send the failing file content and error message to AI for fix generation
5. IF multiple files fail the build check, THEN THE Validation_Phase SHALL process files sequentially, sending one file at a time to AI for fix generation
6. WHEN AI returns a fix response, THE Validation_Phase SHALL validate the response contains modified file content
7. IF AI fix response is valid, THEN THE Validation_Phase SHALL rewrite the affected file with the AI-provided content
8. IF AI fix response is invalid or empty, THEN THE Validation_Phase SHALL count this as a failed retry attempt for that file
9. WHEN a file is rewritten with AI-provided fix, THE Validation_Phase SHALL re-run the build check
10. IF the build check fails for the same file, THEN THE Validation_Phase SHALL retry the fix process up to 3 times total per file
11. IF errors persist after 3 retry attempts for any file, THEN THE Validation_Phase SHALL surface the error to the user including the file path, final error message, and the number of fix attempts made
12. THE Validation_Phase SHALL NOT regenerate the entire application for a single file error

### Requirement 5: Phase 5 — Polish Pass

**User Story:** As a user receiving a clone, I want the final output to be responsive and polished, so that it meets production quality standards

#### Acceptance Criteria

1. WHEN validation passes, THE Polish_Phase SHALL execute a responsive breakpoints pass
2. THE Responsive_Pass SHALL ensure mobile, tablet, and desktop layouts work correctly
3. THE Polish_Phase SHALL execute a spacing and consistency pass
4. THE Consistency_Pass SHALL verify padding, margins, and alignment match the original site
5. WHERE animation is present in the original site, THE Polish_Phase SHALL add light animation effects
6. THE Polish_Phase SHALL mark generation as complete after all passes finish
7. THE Polish_Phase SHALL log all polish operations for debugging
8. IF polish operations fail AND no other critical errors exist, THEN THE System SHALL complete generation with a warning rather than blocking; IF critical errors also exist, THEN THE System SHALL surface the critical errors instead of completing with a warning

### Requirement 6: Phase Orchestration and State Management

**User Story:** As a developer debugging generation issues, I want each phase independently loggable, so that I can trace problems to specific stages

#### Acceptance Criteria

1. THE Generation_Pipeline SHALL expose a phase state machine with states: idle, analyzing, instant_preview, progressive_cloning, validating, polishing, complete, error
2. WHEN phase transitions occur, THE Generation_Pipeline SHALL emit state change events with timestamp and metadata
3. THE Generation_Pipeline SHALL maintain a phase execution log with start time, end time, and outcome for each phase
4. WHEN generation is interrupted, THE Generation_Pipeline SHALL prompt the user to choose between resuming from the last successful phase or restarting generation from the beginning
5. IF a phase fails, THEN THE Generation_Pipeline SHALL record failure reason and allow retry from that phase
6. THE UI SHALL display current phase and sub-progress (e.g., "Progressive Cloning: Hero 2/5")
7. THE Generation_Pipeline SHALL track token usage per phase for cost monitoring

### Requirement 7: Incremental AI Generation Integration

**User Story:** As a system architect, I want AI generation to accept phase and target section parameters, so that it generates scoped code instead of monolithic output

#### Acceptance Criteria

1. THE AI_Generation_Endpoint SHALL accept a "phase" parameter with values: analyze, instant_preview, progressive_clone, polish
2. WHEN phase is "progressive_clone", THE AI_Generation_Endpoint SHALL accept a "targetSection" parameter
3. THE System_Prompt SHALL adapt based on the phase and targetSection to constrain AI output
4. WHEN phase is "instant_preview", THE AI SHALL generate a complete but minimal layout with all sections as placeholders
5. WHEN phase is "progressive_clone", THE AI SHALL generate only the specified targetSection with real content
6. THE AI_Response_Parser SHALL extract files scoped to the current phase and section
7. THE Token_Usage SHALL decrease per-generation compared to monolithic approach due to scoped prompts

### Requirement 8: Progressive File Application

**User Story:** As a system applying generated code, I want to write files incrementally, so that preview updates happen as sections complete

#### Acceptance Criteria

1. THE File_Application_Service SHALL accept an "isProgressive" flag indicating incremental mode
2. WHEN isProgressive is true, THE File_Application_Service SHALL write files immediately as they are parsed; IF a write fails, THE File_Application_Service SHALL retry that file in the background without blocking parsing of subsequent files
3. WHEN files have been successfully parsed and written, THE File_Application_Service SHALL trigger Hot_Reload after writing files in progressive mode
4. THE File_Application_Service SHALL NOT wait for all files to be parsed before writing in progressive mode
5. WHEN Hot_Reload triggers, THE Preview_Iframe SHALL update within 1-2 seconds
6. THE File_Application_Service SHALL batch writes for multiple files targeting the same section
7. IF writes fail, THEN THE File_Application_Service SHALL retry once before escalating to error state

### Requirement 9: Error Recovery and Targeted Fixes

**User Story:** As a user experiencing generation errors, I want only the broken parts fixed, so that I don't lose working sections

#### Acceptance Criteria

1. WHEN a section generation fails, THE Progressive_Cloning_Phase SHALL mark that section as failed
2. THE Progressive_Cloning_Phase SHALL continue generating subsequent sections despite a failed section
3. THE System SHALL retry failed sections up to 2 times with modified prompts
4. WHEN validation errors occur, THE Validation_Phase SHALL send only failing file content and error to AI
5. THE AI SHALL generate a targeted fix patch, not a full file replacement
6. WHEN AI-generated fixes conflict with user-edited sections, THE System SHALL allow the fix to override the user edit in order to restore build validity
7. IF a section fails after retries, THEN THE System SHALL display the section with an error indicator but keep other sections functional
8. IF 3 consecutive section generations fail, THEN THE Progressive_Cloning_Phase SHALL stop processing further sections and surface an error to the user indicating generation was halted due to repeated failures

### Requirement 10: Progress UI and User Feedback

**User Story:** As a user watching generation, I want real-time progress indicators, so that I understand what's happening

#### Acceptance Criteria

1. THE UI SHALL display the current phase name (Analyzing, Generating Preview, Cloning Sections, Validating, Polishing)
2. WHEN in Progressive_Cloning_Phase, THE UI SHALL display section-level progress (e.g., "Hero: Complete", "Features: Generating...")
3. THE UI SHALL show a progress bar reflecting overall completion percentage
4. THE UI SHALL estimate remaining time based on historical phase durations
5. WHEN a section completes, THE UI SHALL animate the completion indicator
6. WHEN errors occur, THE UI SHALL display error context with section name and error type
7. THE UI SHALL allow expanding phase details to view logs and AI token usage together, displaying both in the same expanded panel

### Requirement 11: Backward Compatibility with Edit Flow

**User Story:** As a user editing a cloned site, I want chat-based editing to work the same way, so that I don't lose functionality

#### Acceptance Criteria

1. THE Progressive_Generation_Architecture SHALL NOT alter the chat-based edit flow
2. WHEN a user requests an edit via chat during initial progressive generation, THE System SHALL queue the edit request and apply it after initial generation completes
3. THE Edit_Flow SHALL continue using the file manifest and search-based targeting
4. THE System SHALL distinguish between initial generation (progressive) and post-generation edits (targeted)
5. THE Edit_Flow SHALL apply Morph Fast Apply where applicable for surgical edits
6. THE Progressive_Architecture SHALL not introduce regressions to edit accuracy or speed

### Requirement 12: Parser Requirements for Site Blueprint

**User Story:** As a system processing scraped content, I want a robust blueprint parser, so that analysis data is accurately structured

#### Acceptance Criteria

1. WHEN AI returns analysis results, THE Blueprint_Parser SHALL parse JSON from AI response
2. THE Blueprint_Parser SHALL validate that all required Site_Blueprint fields are present (sections, colors, typography, images)
3. IF parsing fails, THEN THE Blueprint_Parser SHALL return a descriptive error indicating which field is missing or malformed; IF the specific field cannot be determined, THEN THE Blueprint_Parser SHALL return a generic error message (e.g., "parsing failed")
4. FOR ALL valid Site_Blueprint objects, THE System SHALL support round-trip serialization (parse → serialize → parse produces equivalent object)
5. THE Blueprint_Parser SHALL handle edge cases: missing sections, empty color palettes, invalid JSON
6. THE Blueprint_Parser SHALL normalize section names to lowercase with hyphens (e.g., "Hero Section" → "hero-section")
7. THE Blueprint_Parser SHALL log parsing errors with the original AI response for debugging

### Requirement 13: Parser Requirements for Progressive File Extraction

**User Story:** As a system parsing AI output, I want to extract files even when only partial code is returned, so that progressive updates work reliably

#### Acceptance Criteria

1. WHEN AI streams partial file content, THE File_Parser SHALL extract files with incomplete closing tags
2. THE File_Parser SHALL prioritize complete files over incomplete files if duplicates are detected
3. THE File_Parser SHALL detect and merge duplicate file declarations, always preferring the longer version regardless of completeness
4. THE File_Parser SHALL extract files from `<file path="...">` tags and markdown code blocks
5. THE File_Parser SHALL validate that extracted files have valid file extensions (.jsx, .js, .tsx, .ts, .css, .json)
6. IF a file is truncated, THEN THE File_Parser SHALL log a warning but still apply the truncated version
7. THE File_Parser SHALL strip ellipsis placeholders ("...") that are not spread operators

### Requirement 14: Pretty Printer for Site Blueprints

**User Story:** As a developer debugging analysis issues, I want human-readable blueprint output, so that I can verify structure

#### Acceptance Criteria

1. THE Pretty_Printer SHALL format Site_Blueprint JSON with 2-space indentation
2. THE Pretty_Printer SHALL output section names in a bulleted list format for quick scanning
3. THE Pretty_Printer SHALL display color palette as hex codes with color swatches if rendering in UI
4. THE Pretty_Printer SHALL format typography with font family, weights, and sizes in readable tables
5. FOR ALL Site_Blueprint objects, THE Pretty_Printer SHALL produce output that is valid JSON and can be re-parsed
6. THE Pretty_Printer SHALL escape special characters in section descriptions to prevent rendering errors
