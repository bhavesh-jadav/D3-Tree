
export module SVGUtils {

    let svgElement: SVGElement;
    let svgTextElement: SVGTextElement;


    export function Translate(x: number, y: number) {
        return 'translate(' + x + ', ' + y + ')';
    }

    function createDOM() {
        if (svgElement) {
            svgElement.parentElement.removeChild(svgElement);
        }
        svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svgTextElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
        svgElement.appendChild(svgTextElement);
        document.body.appendChild(svgElement);
    }

    // https://github.com/Microsoft/powerbi-visuals-utils-formattingutils/blob/master/src/textMeasurementService.ts
    export function MeasureTextSize(textProperties: TextStyleProperties, text: string) {

        createDOM();

        svgTextElement.setAttribute("style", null);

        svgTextElement.style.visibility = "hidden";
        svgTextElement.style.fontFamily = textProperties.fontFamily || "";
        svgTextElement.style.fontVariant = textProperties.fontVariant;
        svgTextElement.style.fontSize = textProperties.fontSize;
        svgTextElement.style.fontWeight = textProperties.fontWeight;
        svgTextElement.style.fontStyle = textProperties.fontStyle;
        svgTextElement.style.whiteSpace = textProperties.whiteSpace || "nowrap";

        svgTextElement.appendChild(document.createTextNode(text));

        // We're expecting the browser to give a synchronous measurement here
        // We're using SVGTextElement because it works across all browsers
        let  textSize = svgTextElement.getBBox();
        return textSize;
    }

    // https://github.com/Microsoft/powerbi-visuals-utils-formattingutils/blob/master/src/textMeasurementService.ts
    export function GetTailoredTextOrDefault(textProperties: TextStyleProperties, maxWidth: number, sourceText: string): string {
        let ellipsis = '...';
        createDOM();

        let strLength: number = sourceText.length;

        if (strLength === 0) {
            return sourceText;
        }

        let width: number = MeasureTextSize(textProperties, sourceText).width;

        if (width < maxWidth) {
            return sourceText;
        }

        // Create a copy of the textProperties so we don't modify the one that's passed in.
        // let copiedTextProperties = Prototype.inherit(textProperties);

        // Take the properties and apply them to svgTextElement
        // Then, do the binary search to figure out the substring we want
        // Set the substring on textElement argument
        let text = sourceText = ellipsis + sourceText;

        let min = 1;
        let max = text.length;
        let i = ellipsis.length;

        while (min <= max) {
            // num | 0 prefered to Math.floor(num) for performance benefits
            i = (min + max) / 2 | 0;

            sourceText = text.substr(0, i);
            width = MeasureTextSize(textProperties, sourceText).width;

            if (maxWidth > width) {
                min = i + 1;
            } else if (maxWidth < width) {
                max = i - 1;
            } else {
                break;
            }
        }

        // Since the search algorithm almost never finds an exact match,
        // it will pick one of the closest two, which could result in a
        // value bigger with than 'maxWidth' thus we need to go back by
        // one to guarantee a smaller width than 'maxWidth'.
        sourceText = text.substr(0, i);
        width = MeasureTextSize(textProperties, sourceText).width;
        if (width > maxWidth) {
            i--;
        }

        // console.log(textProperties.text, width);
        

        return text.substr(ellipsis.length, i - ellipsis.length) + ellipsis;
    }

    /**
     * Checks if given value is between given boundary(inclusive).
     * @param value Actual value.
     * @param maxPositive Maximum positive boundary.
     * @param maxNegative Maximum negative boundary.
     */
    export function ValidateBoundary(value: number, maxPositive: number, maxNegative: number): number {
        if (value <= maxPositive && value >= maxNegative) {
            return value;
        } else if (value > maxPositive) {
            return maxPositive;
        } else if (value < maxNegative) {
            return maxNegative;
        }
    }
}

// https://github.com/Microsoft/powerbi-visuals-utils-formattingutils/blob/master/src/textMeasurementService.ts
export interface TextStyleProperties {
    fontFamily: string;
    fontSize: string;
    fontWeight?: string;
    fontStyle?: string;
    fontVariant?: string;
    whiteSpace?: string;
}