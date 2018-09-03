import { TreeNodeShapeProperties, ShapeType } from "../../D3TreeInterfaces";

export let nodeShapePropertiesDefault: TreeNodeShapeProperties = {
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

export let nodeShapeProperties1: TreeNodeShapeProperties = {
    shapeType: ShapeType.Rectangle,
    circleRadius: 10,
    rectWidth: 100,
    rectHeight: 70,
    expandedColor: 'red',
    collapsedColor: 'green',
    strokeColor: 'black',
    strokeWidth: 2,
    takeColorFromData: false
}