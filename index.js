const TypeRip = require("./typerip")
const fs = require("fs")

async function main() {
    let page = 1
    let pageStep = 1
    while (page == 1) {
        const fontFamilies = await TypeRip.getFontFamily(page, page + pageStep)

        if (fontFamilies.length == 0) {
            break
        }

        for (const fontFamily of fontFamilies) {
            const ttfs = await TypeRip.downloadFonts(fontFamily.fonts, false)
            for (const [idx, font] of fontFamily.fonts.entries()) {
                console.log("Downloading font", font.name)
                fs.writeFileSync(font.name + ".ttf", ttfs[idx])
            }
        }
        page += pageStep
    }
}

main().then(console.log).catch(console.error)
