const TypeRip = require("./typerip")
const fs = require("fs")

async function main() {
    let page = 1
    let pageStep = 10
    while (true) {
        try {
            const fontFamilies = await TypeRip.getFontFamily(
                page,
                page + pageStep
            )

            if (fontFamilies.length == 0) {
                break
            }

            for (const [familyIndex, fontFamily] of fontFamilies.entries()) {
                try {
                    const ttfs = await TypeRip.downloadFonts(
                        fontFamily.fonts,
                        false
                    )

                    for (const [
                        fontIndex,
                        font,
                    ] of fontFamily.fonts.entries()) {
                        console.log(
                            `Downloading font ${familyIndex}/${
                                fontFamilies.length
                            }/${page}-${page + pageStep} ${font.name}`
                        )

                        if (ttfs[fontIndex].toString() == "") {
                            console.log("Skipping ...")
                            continue
                        }

                        fs.writeFileSync(
                            "./fonts/" + font.name + ".ttf",
                            ttfs[fontIndex]
                        )
                    }
                } catch (err) {
                    console.log(err)
                    continue
                }
            }
            page += pageStep
        } catch (err) {
            console.log(err)
            continue
        }
    }
}

main().then(console.log).catch(console.error)
