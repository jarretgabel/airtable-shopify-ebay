# Claude Code Instructions

## Purpose
Keep responses and edits concise, deterministic, and cheap in tokens.

## Token Budget Rules
- Use short answers by default.
- Prefer bullet lists over long prose.
- Do not repeat context, logs, or requirements already stated.
- Do not print full files unless explicitly asked.
- Show only changed snippets or brief summaries.
- Ask at most one clarifying question only when blocked.

## Code and Change Rules
- Make the smallest safe change.
- Preserve existing patterns, APIs, and formatting.
- Avoid unrelated refactors.
- Include only essential comments.

## Image Watermark Standard (Required)
Apply this standard to every exported listing image unless a task says otherwise.

- Text: "© Resolution Audio Video"
- Font: Helvetica (bold)
- Color: white (#FFFFFF)
- Shadow: black 45% opacity, small blur
- Opacity: 72%
- Placement: bottom-right
- Margin: 2.5% of image width and height
- Scale: watermark width = 18% of image width
- Rotation: 0 degrees
- Consistency: same text, opacity, placement, and scale formula for all images in a batch

## Image File Naming Standard (Required)
Use lowercase kebab-case and ASCII only.

Pattern:
brand-model-product-type-key-detail.jpg

Rules:
- Allowed chars: a-z, 0-9, hyphen
- No spaces, underscores, company name, or extra punctuation
- Strip duplicate hyphens
- Brand and model must come first
- Keep filenames 5-10 words max
- Be clear, not clever
- No random numbers, camera names, or version suffixes

Examples:
- mcintosh-mc275-tube-amplifier-vintage-serviced.jpg
- bowers-wilkins-802d3-speakers-pair-walnut.jpg

Multiple image structure:
- Hero image: brand-model-product-type.jpg
- Additional images: brand-model-key-detail.jpg
- Keep brand-model prefix identical across all images for the same product

Optional descriptor (use one only, when relevant):
- mint, serviced, restored, pair, black, walnut, rare, limited

Prohibited examples:
- IMG_4829.jpg
- final-edit-v2.jpg
- amp1.jpg
- mcintosh-mc275-resolutionav.jpg

Alt text requirement:
- Every uploaded product image must include alt text
- Format: Brand Model + product type + key detail (+ optional company text)

## Validation Checklist
Before finishing image-related tasks, verify:
- Watermark matches standard exactly.
- Filename matches SOP pattern and core rules exactly.
- Brand-model prefix is consistent across the full image set.
- No collisions in target folder.
- Output count matches source count.
