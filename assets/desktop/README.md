# Rocket Run desktop logo

A White House mission-patch badge, with a right-facing rocket, navy field, ivory building, red fins and gold stars.

- `rocket-run.png`: original generated logo, with transparency.
- `rocket-run.ico`: Windows icon containing classic 32-bit DIB frames at 16, 24, 32, 48, 64 and 128 pixels, plus a 256-pixel PNG frame.
- `../../scripts/install-desktop-shortcut.ps1`: installs **Rocket Run - White House Arcade.exe** on the current Windows desktop. It compiles the small launcher locally using the installed .NET Framework compiler and embeds the logo as a Windows application icon. Matching former `.lnk` and `.url` entries are backed up under local application data; unrelated entries are preserved. Reinstalling updates this game's existing application.
- `../../scripts/desktop-launcher.cs`: complete launcher source. It opens only the fixed public game URL in the default browser and exits. No background service, downloaded runtime or separate icon file is needed.
- `../../scripts/create-desktop-icon.ps1`: converts the original PNG into the Windows icon container, without changing the logo design.

Created with the built-in image generation tool. The square PNG is the original output; Windows icon frames are resized format conversions.

The installer verifies the compiled icon resource and copied application before backing up previous entries, then notifies Windows about the desktop change. It does not restart Explorer or erase system icon caches. Native Windows extraction has verified the embedded artwork at all seven icon sizes; actual desktop visibility still needs confirmation on the affected desktop. Use the `.png` file when viewing or sharing the logo as an ordinary image.

## Generation prompt

Use case: logo-brand. Create one polished square Windows desktop app icon for the satirical game Rocket Run, with an American administration / White House mission-patch theme. A bold warm-ivory silhouette of the White House north portico with columns and small central roof flag occupies the upper middle. In front of the lower half of the building, one chunky horizontal rocket points directly RIGHT, ivory body, vivid vermilion red nose and fins, warm gold exhaust streaming left. Three small gold five-point stars across the top. Deep midnight navy rounded-square badge with a clean thin warm-gold inset border, genuinely transparent pixels outside the rounded corners. Restrained ivory, navy, red and gold palette. Flat, precise, graphic emblem with a little arcade/pixel character in the rocket silhouette, high contrast, crisp edges and large simplified shapes readable at 32–64 pixels. Center the mark, fill most of the square with modest padding. No wording or letters, no tiny ornament, no photographic texture, no mockup, no surroundings, no drop shadow outside the badge, no gradients, no eagle or official seal. Output a single square icon, not a sheet of alternatives.
