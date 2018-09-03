import { TreeNodeShapeProperties, ShapeType } from "../../D3TreeInterfaces";

export let nodeShapeProperties1: TreeNodeShapeProperties = {
    shapeType: ShapeType.Circle,
    circleRadius: 10,
    rectWidth: 20,
    rectHeight: 20,
    expandedColor: 'red',
    collapsedColor: 'green',
    strokeColor: 'black',
    strokeWidth: 2,
    takeColorFromData: false
}