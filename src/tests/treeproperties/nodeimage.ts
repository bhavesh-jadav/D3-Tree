import { TreeNodeImageProperties, ShapeType, Position } from "../../D3TreeInterfaces";

export let nodeImagePropertiesDefault: TreeNodeImageProperties = {
    showImage: true,
    height:20,
    width:20,
    strokeColor: 'black',
    strokeWidth: 3,
    shape: ShapeType.None,
    xOffset: 0,
    yOffset: 0,
    position: Position.Top,
    defaultImageURL: 'https://i.stack.imgur.com/KIqMD.png'
}

export let nodeImageProperties1: TreeNodeImageProperties = {
    showImage: true,
    height:20,
    width:20,
    strokeColor: 'black',
    strokeWidth: 3,
    shape: ShapeType.None,
    xOffset: 0,
    yOffset: 0,
    position: Position.Right,
    defaultImageURL: 'https://i.stack.imgur.com/KIqMD.png'
}