# RF4 Recipe Viewer - Specifications

## Overview
The RF4 Recipe Viewer is a lightweight, mobile-first Progressive Web App (PWA) designed to provide quick and offline-capable lookups for crafting, forging, chemistry, and cooking recipes in Rune Factory 4 Special. The primary goal is extreme performance, minimal storage footprint, and a highly responsive user experience.

## Core Features
1. **Recipe Filtering System:**
   - **Grid Search:** Users can select up to 6 ingredients in a matrix to find recipes that use those materials.
   - **Skill Filter:** Allows narrowing down results by primary skills (`Crafting`, `Forging`, `Chemistry`, `Cooking`).
   - **Subtype Filter:** Dynamically updates based on the selected skill (e.g., `Short Sword`, `Oven`, `Medicine`, `Tool`, `No Tool`) to precisely target specific item categories.
2. **Recipe Details & Stats:** Clickable recipe results that display the full material list, the recipe's required skill and level, and all non-zero weapon/armor statistics (ATK, MATK, DEF, Elemental Resistances, etc.).
3. **Loadout Editor Main Page:** A dedicated screen tracking 6 equipment slots (Weapon, Shield, Headgear, Armor, Shoes, Accessory). It calculates cumulative stat totals for the equipped items and allows users to export/import their loadouts via a Base64 encoded hash code for easy sharing. It also wraps equipped items in `CustomItem` to support customized recipes and inheritance slot tracking.
4. **Global Hamburger Navigation:** A slide-out sidebar menu allowing users to switch seamlessly between the two main pages: the **Recipe Viewer** and the **Loadout Editor**.
5. **PWA Capabilities:** Fully installable and usable offline through Service Worker caching and a web app manifest.

## Technical Architecture
- **Frontend:** Vanilla HTML5, CSS3 (using Flexbox and CSS Grid), and modern JavaScript (ES6 Modules). No heavyweight frameworks (React, Angular) to ensure lightning-fast load times.
- **Backend/Data Pipeline:** A Python-based conversion script (`scripts/convert.py`) that pre-processes raw game data dumps (`datamine.xlsx` and `recipes.txt`) into an ultra-compressed `data.json` format.

## Data Optimization Principles
- **Global String Interning:** All unique strings (column headers, item names, recipe types) are extracted into a single 1-indexed `strings` array. Data records reference these strings via integer IDs.
- **Columnar Matrix Format:** Instead of arrays of objects with repeating keys, the JSON structure uses a 2D array (list of lists) where the first array contains the header references.
- **Aggressive Null/Zero Pruning:** Empty, falsy, and zero values (`0`, `#00000000`, `(nothing)`) are mapped to the integer `0`. Furthermore, all trailing zeros at the end of a record array are popped, saving maximum bytes per record. 
- **Consolidated Categorization:** Complex and overlapping subclassifications from raw game data are mapped into logical groups (e.g., separating "Cook & Chem Recipes" into proper "Cooking" and "Chemistry" skills; aggregating all farming implements into a single "Tool" subtype).

## Design Philosophy
- Prioritize load time and offline capability over complex animations.
- Rely on modern browser features (Service Workers, Native ES Modules).
- Maintain a clean separation of concerns: HTML for structure, CSS for layout/styling, JS for interactivity and data decoding.