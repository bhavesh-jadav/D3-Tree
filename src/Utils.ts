
export module SVGUtils {
    export function Translate(x: number, y: number) {
        return 'translate(' + x + ', ' + y + ')';
    }

    // https://github.com/Microsoft/powerbi-visuals-utils-formattingutils/blob/master/src/textMeasurementService.ts
    export function MeasureTextSize(textProperties: TextProperties, text?: string) {

        const svgElement: SVGElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        let svgTextElement: SVGTextElement = document.createElementNS("http://www.w3.org/2000/svg", "text");
        svgElement.appendChild(svgTextElement);
        document.body.appendChild(svgElement);

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
        svgElement.parentElement.removeChild(svgElement);
        return textSize;
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