import { TreeNodeShapeProperties, ShapeType } from "../../D3TreeInterfaces";

export let nodeShapeProperties1: TreeNodeShapeProperties = {
    shapeType: ShapeType.Rectangle,
    circleRadius: 25,
    rectWidth: 100,
    rectHeight: 70,
    expandedColor: 'red',
    collapsedColor: 'green',
    strokeColor: 'black',
    strokeWidth: 2,
    takeColorFromData: false
}