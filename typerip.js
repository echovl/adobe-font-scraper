const axios = require("axios")
const opentype = require("./opentype.js")

async function getFontFamily(pageStart, pageEnd) {
    const fontFamilies = []
    for (let i = pageStart; i <= pageEnd; i++) {
        const url = `https://fonts.adobe.com/fonts.json?browse_mode=default&cc=true&max_styles=26&min_styles=1&page=${i}`
        const response = await axios.get(url)

        const textSampleData = response.data.text_sample_data
        for (const json of response.data.families_data.families) {
            let fontFamily = {
                name: "",
                fonts: [],
            }
            //find the default language of this font
            fontFamily.defaultLanguage = json.display_font.default_language

            //grab the sample text data for this language
            fontFamily.sampleText =
                textSampleData.textSamples[fontFamily.defaultLanguage]["list"]

            //family/foundry names
            fontFamily.foundryName = json.foundry.name
            fontFamily.name = json.name
            fontFamily.slug = json.slug

            //populate subfonts
            for (let i = 0; i < json.fonts.length; i++) {
                fontFamily.fonts.push({
                    //the magic is in the "unicode=AAAAAQAAAAEAAAAB&features=ALL&v=3"m which (apparently) requests the entire font set from the server :)
                    url:
                        "https://use.typekit.net/pf/tk/" +
                        json.fonts[i].family.web_id +
                        "/" +
                        json.fonts[i].font.web.fvd +
                        "/a?unicode=AAAAAQAAAAEAAAAB&features=ALL&v=3&ec_token=3bb2a6e53c9684ffdc9a9bf71d5b2a620e68abb153386c46ebe547292f11a96176a59ec4f0c7aacfef2663c08018dc100eedf850c284fb72392ba910777487b32ba21c08cc8c33d00bda49e7e2cc90baff01835518dde43e2e8d5ebf7b76545fc2687ab10bc2b0911a141f3cf7f04f3cac438a135f",
                    name: json.fonts[i].name,
                    style: json.fonts[i].variation_name,
                    familyName: fontFamily.name,
                    familyUrl: "https://fonts.adobe.com/fonts/" + json.slug,
                })
            }
            fontFamilies.push(fontFamily)
        }
    }

    return fontFamilies
}

async function downloadFonts(fonts_, rawDownload_) {
    fontList = []
    if (Array.isArray(fonts_)) {
        //more than one font
        fontList = fonts_
    } else {
        //only one font
        fontList = [fonts_]
    }

    const fontBuffers = []
    for (var i = 0; i < fontList.length; i++) {
        fontBuffers.push(await getAndRepairFont(fontList[i], rawDownload_))
    }
    return fontBuffers
}

async function getAndRepairFont(font_, rawDownload_) {
    if (rawDownload_) {
        const response = await axios.get(font_.url, {
            responseType: "arraybuffer",
        })

        return response.data
    } else {
        return new Promise((resolve, reject) => {
            opentype.load(font_.url, function (error_, fontData_) {
                if (error_) {
                    reject(new Error("font failed to load"))
                } else {
                    //Rebuild the glyph data structure. This repairs any encoding issues.
                    let rebuiltGlyphs = []

                    //for every glyph in the parsed font data:
                    for (let i = 0; i < fontData_.glyphs.length; i++) {
                        //Create a structure to hold the new glyph data
                        let glyphData = {}

                        let glyphFields = [
                            "name",
                            "unicode",
                            "unicodes",
                            "path",
                            "index",
                            "advanceWidth",
                            "leftSideBearing",
                        ]

                        glyphFields.forEach((field) => {
                            if (fontData_.glyphs.glyphs[i][field] != null) {
                                glyphData[field] =
                                    fontData_.glyphs.glyphs[i][field]
                            }
                        })

                        //HOTFIX #1     If the advanceWidth of a glyph is NaN, opentype will crash.
                        //SOLUTION:     Ensure advanceWidth has non-NaN AND non-0 value
                        if (
                            glyphData.advanceWidth == null ||
                            isNaN(glyphData.advanceWidth)
                        ) {
                            let newAdvanceWidth = Math.floor(
                                fontData_.glyphs.glyphs[i].getBoundingBox().x2
                            )
                            if (newAdvanceWidth == 0) {
                                newAdvanceWidth =
                                    fontData_.glyphs.glyphs[0].getBoundingBox()
                                        .x2
                            }
                            glyphData.advanceWidth = newAdvanceWidth
                        }

                        //Rebuild the new glyph.
                        let rebuiltGlyph = new opentype.Glyph(glyphData)

                        //HOTFIX #2:    If fields with a value of 0 are used in the constructor, opentype will simply not set them in the object.
                        //SOLUTION:     Manually go through every 0 field that should have been set in the constructor, and set it. ( https://github.com/opentypejs/opentype.js/issues/375 )
                        glyphFields.forEach((field) => {
                            if (
                                glyphData[field] != null &&
                                glyphData[field] == 0
                            ) {
                                rebuiltGlyph[field] = 0
                            }
                        })

                        //push the rebuilt glyph to an array.
                        rebuiltGlyphs.push(rebuiltGlyph)
                    }

                    //create a structure of font data with fields from the parsed font.
                    let newFontData = {
                        familyName: font_.familyName,
                        styleName: font_.style,
                        glyphs: rebuiltGlyphs,
                    }

                    //extract as much available data out of the existing font data and copy it over to the new font:
                    let optionalFontDataFields = [
                        "defaultWidthX",
                        "nominalWidthX",
                        "unitsPerEm",
                        "ascender",
                        "descender",
                    ]
                    optionalFontDataFields.forEach((field) => {
                        if (fontData_[field] != null) {
                            newFontData[field] = fontData_[field]
                        }
                    })

                    //rebuild and download the font.
                    let newFont = new opentype.Font(newFontData)

                    resolve(newFont.ToNodeBuffer())
                }
            })
        })
    }
}

module.exports = { getFontFamily, downloadFonts }
