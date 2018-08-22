
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
    export function MeasureTextSize(textProperties: TextProperties, text?: string) {

        createDOM();

        svgTextElement.setAttribute("style", null);

        svgTextElement.style.visibility = "hidden";
        svgTextElement.style.fontFamily = textProperties.fontFamily || "";
        svgTextElement.style.fontVariant = textProperties.fontVariant;
        svgTextElement.style.fontSize = textProperties.fontSize;
        svgTextElement.style.fontWeight = textProperties.fontWeight;
        svgTextElement.style.fontStyle = textProperties.fontStyle;
        svgTextElement.style.whiteSpace = textProperties.whiteSpace || "nowrap";

        svgTextElement.appendChild(document.createTextNode(text || textProperties.text));

        // We're expecting the browser to give a synchronous measurement here
        // We're using SVGTextElement because it works across all browsers
        let  textSize = svgTextElement.getBBox();
        return textSize;
    }

    // https://github.com/Microsoft/powerbi-visuals-utils-formattingutils/blob/master/src/textMeasurementService.ts
    export function GetTailoredTextOrDefault(textProperties: TextProperties, maxWidth: number): string {
        let ellipsis = '...';
        createDOM();

        let strLength: number = textProperties.text.length;

        if (strLength === 0) {
            return textProperties.text;
        }

        let width: number = MeasureTextSize(textProperties).width;

        if (width < maxWidth) {
            return textProperties.text;
        }

        // Create a copy of the textProperties so we don't modify the one that's passed in.
        // let copiedTextProperties = Prototype.inherit(textProperties);

        // Take the properties and apply them to svgTextElement
        // Then, do the binary search to figure out the substring we want
        // Set the substring on textElement argument
        let text = textProperties.text = ellipsis + textProperties.text;

        let min = 1;
        let max = text.length;
        let i = ellipsis.length;

        while (min <= max) {
            // num | 0 prefered to Math.floor(num) for performance benefits
            i = (min + max) / 2 | 0;

            textProperties.text = text.substr(0, i);
            width = MeasureTextSize(textProperties).width;

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
        textProperties.text = text.substr(0, i);
        width = MeasureTextSize(textProperties).width;
        if (width > maxWidth) {
            i--;
        }

        // console.log(textProperties.text, width);
        

        return text.substr(ellipsis.length, i - ellipsis.length) + ellipsis;
    }
}

// https://github.com/Microsoft/powerbi-visuals-utils-formattingutils/blob/master/src/textMeasurementService.ts
export interface TextProperties {
    text?: string;
    fontFamily: string;
    fontSize: string;
    fontWeight?: string;
    fontStyle?: string;
    fontVariant?: string;
    whiteSpace?: string;
}