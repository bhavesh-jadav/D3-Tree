import { 
    TreeGeneralProperties, TreeLinkProperties, TreeNodeTextProperties,
    TreeProperties, TreeNodeShapeProperties, ShapeType,
    Orientation, LineType, TreePointNode, TreeData,
    TreeNodeProperties, TreeNodeImageProperties, Position
} from './D3TreeInterfaces';
import { 
    tree, hierarchy, TreeLayout, cluster,
    HierarchyPointLink, HierarchyNode
} from 'd3-hierarchy';
import { SVGUtils, TextStyleProperties } from './Utils';
import { linkHorizontal, linkVertical } from 'd3-shape';
import { Selection, select, BaseType, event } from 'd3-selection';
import { zoom, zoomIdentity, ZoomBehavior, zoomTransform } from 'd3-zoom';
import { max } from 'd3-array';
import * as d3_ease from 'd3-ease';
import 'd3-transition';

// SVG Utils
let Translate = SVGUtils.Translate;
let MeasureTextSize = SVGUtils.MeasureTextSize;
let GetTailoredTextOrDefault = SVGUtils.GetTailoredTextOrDefault;
let ValidateBoundary = SVGUtils.ValidateBoundary;

export class D3Tree {

    private treeGroup: Selection<BaseType, any, any, any>; // Holds the parent group element of the tree.
    private treeLayout: TreeLayout<any>; // Holds definition of function to create tree layout based on given tree type, size and hierarchy data.
    private hierarchyData: HierarchyNode<any>; // Holds hierarchy data which gives information such as depth and height of the nodes and other info.
    private treeNodes: TreePointNode<any>; // Holds tree data created from treeMap and hierarchyData with info such as x and y coordinate of the node.
    private treeNodeArray: TreePointNode<any>[]; // Holds nodes in form of array in chronological order from top to bottom.
    private treeDataLinks: HierarchyPointLink<any>[]; // Holds definition of links between nodes.
    private enableZoom: boolean = false; // enable zoom when there is no treeheight and width is provided.
    private maxExpandedDepth: number; // will store max depth of tree visible on screen
    private rootSVGZoomListener: ZoomBehavior<Element, {}>;
    private nodeUID = 0; // Used to uniquely identify nodes in tree and it will be used by d3 data joins for enter, update and exit
    private textStyleProperties: TextStyleProperties;

    // node variables *******************************************************************************************************
    private nodes: Selection<BaseType, TreePointNode<any>, BaseType, any>; // holds all nodes selection i.e. nodes that needs to be created, updated or removed.
    private nodesEnter: Selection<BaseType, TreePointNode<any>, BaseType, any>; // holds all nodes that needs to created.
    private nodeShapeHeight: number;
    private nodeShapeWidth: number;

    /**
     * 
     * @param rootSVG Root SVG element where tree will be created
     * @param data JSON Data in form of tree structure
     * @param treeProperties TreeProperties object that specifies different properties and settings of the tree.
     */
    constructor (private rootSVG: Selection<BaseType, any, any, any>, private data: TreeData, private readonly treeProperties: TreeProperties) { 
        this._setDefaultValuesForTreeProperties();
    }

    /**
     * Call this function which will create initial tree structure based on `generalProperties` specified in
     * `treeProperties` in constructor.
     */
    CreateTree() {

        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeProperties.shapeProperties;
        let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeProperties.textProperties;

        // set text style which will be used later to calculated text size in px.
        this.textStyleProperties = {
            fontFamily: nodeTextProperties.fontFamily,
            fontSize: nodeTextProperties.fontSize,
            fontStyle: nodeTextProperties.fontStyle,
            fontWeight: nodeTextProperties.fontWeight
        }

        // set maxExpandedDepth to defaultMaxDepth
        this.maxExpandedDepth = generalProperties.defaultMaxDepth;

        // Generate hierarchy data which gives depth, height and other info.
        this.hierarchyData = hierarchy(this.data, (treeDatum: TreeData) => {
            return treeDatum.children;
        });

        /**
         * Recursive function used to collapse tree nodes based on defaultMaxDepth property of generalSettings.
         * @param node tree node
         */
        let collapseNodes = (node: any) => {
            if(node.children && node.depth >= generalProperties.defaultMaxDepth) {
                node._children = node.children
                node._children.forEach(collapseNodes);
                node.children = null
            }
        }
        this.hierarchyData.each(collapseNodes); // collapse tree nodes based on DefaultMaxDepth

        // add parent group for tree to rootSVG element.
        this.treeGroup = this.rootSVG
            .append('g')
            .classed('treeGroup', true);

        // calculate node size i.e. acutal height and width for spacing purpose.
        if (nodeShapeProperties.shapeType == ShapeType.Circle) {
            this.nodeShapeHeight = this.nodeShapeWidth = 2 * nodeShapeProperties.circleRadius;
        } else if (nodeShapeProperties.shapeType == ShapeType.Rectangle) {
            this.nodeShapeHeight = nodeShapeProperties.rectHeight;
            this.nodeShapeWidth = nodeShapeProperties.rectWidth;
        }

        // if text needs to be shown inside the shape then we set `maxAllowedWidth` of text properties to size of node
        if (nodeTextProperties.showTextInsideShape) {
            nodeTextProperties.maxAllowedWidth = this.nodeShapeWidth;
        }

        // only add zoom when no fixed treeheight and treewidth is provided.
        if (generalProperties.enableZoom) {
            this.enableZoom = true;
            // this.rootSVG.style('cursor', 'grab')
        }

        this._updateTree(); // update the tree if already created or make a new tree.
        if (this.enableZoom) {
            this._centerNode(this.treeNodes); // center the root node.
        }
    }

    /**
     * Updates the tree such as updating nodes, nodes shapes, node links etc. based on user interaction.
     */
    private _updateTree() {
        this._createTreeData();
        this._createNodeGroups();
        this._createNodeShapes();
        this._createNodeLinks();
        this._createNodeText();
    }

    private _setDefaultValuesForTreeProperties() {
        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeProperties: TreeNodeProperties = this.treeProperties.nodeProperties;
        let nodeShapeProperties: TreeNodeShapeProperties = nodeProperties.shapeProperties;
        let nodeTextProperties: TreeNodeTextProperties = nodeProperties.textProperties;
        let nodeImageProperties: TreeNodeImageProperties = nodeProperties.imageProperties;
        let treeLinkProperties: TreeLinkProperties = this.treeProperties.linkProperties;

        // general properties
        if (generalProperties.isClusterLayout == undefined) {
            generalProperties.isClusterLayout = false;
        }
        if (generalProperties.depthWiseHeight == undefined) {
            generalProperties.depthWiseHeight = 0;
        }
        if (generalProperties.minZoomScale == undefined) {
            generalProperties.minZoomScale = 0.2;
        }
        if (generalProperties.maxZoomScale == undefined) {
            generalProperties.minZoomScale = 3;
        }
        if (generalProperties.extraSpaceBetweenNodes == undefined) {
            generalProperties.extraSpaceBetweenNodes = 0;
        }

        // node properties
        if (nodeProperties.animationDuration == undefined) {
            nodeProperties.animationDuration = 1000;
        }

        // node shape properties
        if (nodeShapeProperties.takeColorsFromData == undefined) {
            nodeShapeProperties.takeColorsFromData = false;
        }

        // node text properties
        if (nodeTextProperties.backgroundColor == undefined) {
            nodeTextProperties.backgroundColor = '#F2F2F2';
        }
        if (nodeTextProperties.fontWeight == undefined) {
            nodeTextProperties.fontWeight = 'normal';
        }
        if (nodeTextProperties.fontStyle == undefined) {
            nodeTextProperties.fontStyle = 'normal';
        }
        if (nodeTextProperties.spaceBetweenNodeAndText == undefined) {
            nodeTextProperties.spaceBetweenNodeAndText = 5;
        }
        if (nodeTextProperties.maxAllowedWidth == undefined) {
            nodeTextProperties.maxAllowedWidth = 50;
        }
        if (nodeTextProperties.showTextInsideShape == undefined) {
            nodeTextProperties.showTextInsideShape = false;
        }
        if (nodeTextProperties.textPadding == undefined) {
            nodeTextProperties.textPadding = 0;
        }
        if (nodeTextProperties.takeColorsFromData == undefined) {
            nodeTextProperties.takeColorsFromData = false;
        }

        // node image properties
        if (nodeImageProperties.defaultImageURL == undefined) {
            nodeImageProperties.defaultImageURL = 'https://i.stack.imgur.com/KIqMD.png';
        }
        if (nodeImageProperties.height == undefined || nodeImageProperties.width == undefined) {
            nodeImageProperties.height = nodeImageProperties.width = 30;
        }
        if (nodeImageProperties.strokeColor == undefined) {
            nodeImageProperties.strokeColor = 'none'
        }
        if (nodeImageProperties.strokeWidth == undefined) {
            nodeImageProperties.strokeWidth = 0;
        }
        if (nodeImageProperties.shape == undefined) {
            nodeImageProperties.shape = ShapeType.None;
        }
        if (nodeImageProperties.position == undefined) {
            nodeImageProperties.position = Position.Left;
        }
        if (nodeImageProperties.xOffset == undefined) {
            nodeImageProperties.xOffset = 0;
        }
        if (nodeImageProperties.yOffset == undefined) {
            nodeImageProperties.yOffset = 0;
        }

        // node link properties
        if (treeLinkProperties.animationDuration == undefined) {
            treeLinkProperties.animationDuration = 1000;
        }
        if (treeLinkProperties.takeColorsFromData == undefined) {
            treeLinkProperties.takeColorsFromData = false;
        }
    }

    /**
     * Creates D3 tree data based on json tree data provided in constructor
     */
    private _createTreeData() {

        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeProperties.textProperties;

        let treeHeight: number;
        let treeWidth: number = 100; // assign random width.

        if (this.enableZoom) {
            if (nodeTextProperties.showTextInsideShape) {
                if (generalProperties.orientation == Orientation.Horizontal) {
                    treeHeight = this.hierarchyData.leaves().length * (this.nodeShapeHeight + generalProperties.extraSpaceBetweenNodes);
                } else {
                    treeHeight = this.hierarchyData.leaves().length * (this.nodeShapeWidth + generalProperties.extraSpaceBetweenNodes);
                }
            } else {
                let textHeight = MeasureTextSize(this.textStyleProperties, this.hierarchyData.data.name).height + nodeTextProperties.textPadding;

                // if node shape size is greater than text height than use that for treeHeight calculation
                let perNodeHeight: number = textHeight > this.nodeShapeHeight ? textHeight : this.nodeShapeHeight + generalProperties.extraSpaceBetweenNodes;
                let perNodeWidth: number = nodeTextProperties.maxAllowedWidth + nodeTextProperties.textPadding * 2;
                if (generalProperties.orientation == Orientation.Horizontal) {
                    treeHeight = this.hierarchyData.leaves().length * perNodeHeight;
                } else {
                    treeHeight = this.hierarchyData.leaves().length * perNodeWidth;
                }
            }

            // zoom will change transform of group element which is child of root SVG and parent of tree
            let treeGroupZoomAction = () => {      
                this.treeGroup.attr('transform', event.transform);
                // this.rootSVG.style('cursor', 'grab');
            }

            // listener will be attached to root SVG.
            this.rootSVGZoomListener = zoom().scaleExtent([generalProperties.minZoomScale, generalProperties.maxZoomScale])
                // .on('start', () => {
                //     console.log('start');
                //     this.rootSVG.style('cursor', 'grabbing');
                // })
                // .on('end', () => {
                //     console.log('end');
                //     this.rootSVG.style('cursor', 'grab');
                // })
                .on('zoom', treeGroupZoomAction)
                .filter(() => {
                    return (
                        (event as MouseEvent).button == 1 ||
                        event instanceof WheelEvent
                    );
                });
            
            this.rootSVG.call(this.rootSVGZoomListener)
            .on('dblclick.zoom', () => {
                // center to root node on double click.
                this._centerNode(this.treeNodes); 
            })
            .on('ondragstart', () => {
                this.rootSVG.style('cursor', 'grabbing');
            });
        } else {
            // to set right margin for fixed height and width tree, we do following calculations.
            let fixedMarginForTree = 10;
            let rootNodeTextSize = MeasureTextSize(this.textStyleProperties, this.hierarchyData.data.name);
            if (generalProperties.orientation == Orientation.Horizontal) {
                let maxLeaveNodesTextWidth = 0;
                let rootNodeWidth = 0;
                let fixedNodeWidth = nodeTextProperties.textPadding + nodeTextProperties.spaceBetweenNodeAndText + this.nodeShapeWidth / 2;

                if (nodeTextProperties.showTextInsideShape) {
                    rootNodeWidth = this.nodeShapeWidth / 2;
                } else {
                    rootNodeWidth = rootNodeTextSize.width + fixedNodeWidth;
                }

                this.hierarchyData.leaves().forEach((node: TreePointNode<any>) => {
                    let textWidth = MeasureTextSize(this.textStyleProperties, node.data.name).width;
                    maxLeaveNodesTextWidth = Math.max(textWidth, maxLeaveNodesTextWidth);
                });
 
                if (nodeTextProperties.showTextInsideShape) {
                    treeWidth = generalProperties.containerWidth - this.nodeShapeWidth;
                } else {
                    treeWidth = generalProperties.containerWidth - (rootNodeWidth + maxLeaveNodesTextWidth + fixedNodeWidth);
                }
                treeWidth -= fixedMarginForTree * 2;
                treeHeight = generalProperties.containerHeight - fixedMarginForTree * 2;

                this.treeGroup.transition()
                    .duration(1000)
                    .attr('transform', Translate(rootNodeWidth + fixedMarginForTree, fixedMarginForTree));
            } else {
                let nodeHeight = 0;
                let fixedNodeHeight = nodeTextProperties.textPadding + nodeTextProperties.spaceBetweenNodeAndText + this.nodeShapeHeight / 2;

                if (nodeTextProperties.showTextInsideShape) {
                    nodeHeight = this.nodeShapeHeight / 2;
                } else {
                    nodeHeight = rootNodeTextSize.height + fixedNodeHeight;
                }

                if (nodeTextProperties.showTextInsideShape) {
                    treeWidth = generalProperties.containerHeight - this.nodeShapeHeight;
                } else {
                    treeWidth = generalProperties.containerHeight - nodeHeight * 2;
                }
                treeHeight = generalProperties.containerWidth - fixedMarginForTree * 2;
                treeWidth -= fixedMarginForTree * 2;

                this.treeGroup.transition()
                    .duration(1000)
                    .attr('transform', Translate(fixedMarginForTree, fixedMarginForTree + nodeHeight));
            }
        }

        if (generalProperties.isClusterLayout) {
            this.treeLayout =  cluster().size([treeHeight, treeWidth]);
        } else {
            this.treeLayout =  tree().size([treeHeight, treeWidth]);
        }

        // get final data
        this.treeNodes = this.treeLayout(this.hierarchyData);
        this.treeNodeArray = this.treeNodes.descendants();

        this.treeNodeArray.forEach((node) => {
            node.y = node.depth * generalProperties.depthWiseHeight;
            // if orientation is horizontal than swap the x and y
            if (generalProperties.orientation == Orientation.Horizontal) {
                node.x = node.x + node.y;
                node.y = node.x - node.y;
                node.x = node.x - node.y;
            }
        });

        this.treeDataLinks = this.treeNodes.links();
    }

    /**
     * Updates nodes selection with latest data and adds new node groups into DOM.
     */
    private _createNodeGroups() {

        let nodeProperties: TreeNodeProperties = this.treeProperties.nodeProperties;
        let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeProperties.shapeProperties;

        this.nodes = this.treeGroup.selectAll('g.node')
            .data(this.treeNodeArray, (node: any) => {
                return (node.id || (node.id = ++this.nodeUID));
            });

        this.nodesEnter = this.nodes.enter()
            .append('g')
            .classed('node', true)
            .attr('transform', (node: TreePointNode<any>) => {
                return Translate(node.x, node.y);
            });

        // animation will be applicable for whole node i.e. shape, text, image etc.
        if (nodeProperties.animation) {
            this.nodesEnter.attr('opacity', 0)
                .transition()
                .duration(nodeProperties.animationDuration)
                // .ease(d3_ease.easeCubicOut)
                .attr('opacity', 1);

            this.nodes.transition()
                .duration(nodeProperties.animationDuration)
                .attr('transform', (node: TreePointNode<any>) => {
                    return Translate(node.x, node.y);
                });

            this.nodes.select('.node-shape')
            .transition()
            .duration(nodeProperties.animationDuration)
            .attr('fill', (node: TreePointNode<any>) => {
                    return node._children ? nodeShapeProperties.collapsedNodeColor : nodeShapeProperties.expandedNodeColor;
                });

            this.nodes.exit()
                .attr('opacity', 1)
                .transition()
                .duration(nodeProperties.animationDuration)
                // .ease(d3_ease.easeCubicOut)
                .attr('opacity', 0)
                .remove();
        } else {
            this.nodesEnter.attr('opacity', 1);

            this.nodes.attr('transform', (node: TreePointNode<any>) => {
                    return Translate(node.x, node.y);
                });

            this.nodes.select('.node-shape')
                .attr('fill', (node: TreePointNode<any>) => {
                    return node._children ? nodeShapeProperties.collapsedNodeColor : nodeShapeProperties.expandedNodeColor;
                });

            this.nodes.exit().remove();
        }
    }

    private _createNodeShapes() {
        let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeProperties.shapeProperties;
        let click = (node: any) => {
            if (node.children) { // collapse
                node._children = node.children;
                node.children = null;
            } else if(node._children) {  // expand
                node.children = node._children;
                node._children = null;
            }
            if (this.enableZoom) {
                // finding maximum expanded depth for dynamic height calculation.
                this.maxExpandedDepth = max(this.hierarchyData.leaves().map((node) => { return node.depth }));
            }
            this._updateTree();
            if (this.enableZoom) {
                this._centerNode(node);
            }
        }

        let nodeShape;
        if (nodeShapeProperties.shapeType == ShapeType.Circle) {
            nodeShape = this.nodesEnter.append('circle')
                .attr('r', nodeShapeProperties.circleRadius)
        } else if (nodeShapeProperties.shapeType == ShapeType.Rectangle) {
            nodeShape = this.nodesEnter.append('rect')
                .attr('x', 0 - nodeShapeProperties.rectWidth / 2)
                .attr('y', 0 - nodeShapeProperties.rectHeight / 2)
                .attr('height', nodeShapeProperties.rectHeight)
                .attr('width', nodeShapeProperties.rectWidth)
        }

        nodeShape.classed('node-shape', true)
            .attr('fill', (node: TreePointNode<any>) => {
                return node._children ? nodeShapeProperties.collapsedNodeColor : nodeShapeProperties.expandedNodeColor;
            })
            .attr('stroke', nodeShapeProperties.strokeColor)
            .attr('stroke-width', nodeShapeProperties.strokeWidth);

        this.nodesEnter.on('click', click)
            .on('mouseover', (node: TreePointNode<any>, i: number, elements: Element[]) => {
                if (node.children || node._children) {
                    select(elements[i]).style('cursor', 'pointer')  ;
                }
            });

        if (this.treeProperties.nodeProperties.imageProperties.showImage) {
            this._addImageToNode();
        }

        this.nodesEnter.append('title')
            .text((node: TreePointNode<any>) => {
                return node.data.name;
            });
    }

    private _addImageToNode() {
        let nodeImageProperties: TreeNodeImageProperties = this.treeProperties.nodeProperties.imageProperties;
        let nodeImageEnter = this.nodesEnter.append('g')
            .classed('node-image', true);

        let imageX = () => {
            let x: number = 0;
            let positiveX: number = this.nodeShapeWidth / 2;
            let negativeX: number = -this.nodeShapeWidth / 2 - nodeImageProperties.width;

            if (!this.treeProperties.nodeProperties.textProperties.showTextInsideShape) {
                x = -nodeImageProperties.width / 2;
            } else if (nodeImageProperties.position == Position.Left) {
                x = -this.nodeShapeWidth / 2 + nodeImageProperties.xOffset;
                x = ValidateBoundary(x, positiveX, negativeX);
            } else if (nodeImageProperties.position == Position.Right) {
                x = this.nodeShapeWidth / 2 - nodeImageProperties.width + nodeImageProperties.xOffset;
                x = ValidateBoundary(x, positiveX, negativeX);
            } else if (nodeImageProperties.position == Position.Top || nodeImageProperties.position == Position.Bottom) {
                x = -nodeImageProperties.width / 2;
            }
            return x;
        }

        let imageY = () => {
            let y: number = 0;
            let positiveY: number = this.nodeShapeHeight / 2;
            let negativeY: number = -this.nodeShapeHeight / 2 - nodeImageProperties.height;
            if (nodeImageProperties.position == Position.Left || nodeImageProperties.position == Position.Right) {
                y = -nodeImageProperties.height / 2;
            } else if (nodeImageProperties.position == Position.Top) {
                y = -this.nodeShapeHeight / 2 - nodeImageProperties.yOffset;
                y = ValidateBoundary(y, positiveY, negativeY);
            } else if (nodeImageProperties.position == Position.Bottom) {
                y = this.nodeShapeHeight / 2 - nodeImageProperties.height - nodeImageProperties.yOffset;
                y = ValidateBoundary(y, positiveY, negativeY);
            }
            return y;
        }

        if (nodeImageProperties.shape != ShapeType.None) {
            let nodeImageShapeEnter;
            if (nodeImageProperties.shape == ShapeType.Circle) {
                nodeImageShapeEnter = nodeImageEnter.append('circle')
                .attr('r', () => {
                    return nodeImageProperties.height / 2;
                })
                .attr('cx', imageX() + nodeImageProperties.width / 2)
                .attr('cy', 0);
            } else if (nodeImageProperties.shape == ShapeType.Rectangle) {
                nodeImageShapeEnter = nodeImageEnter.append('rect')
                .attr('height', nodeImageProperties.height)
                .attr('width', nodeImageProperties.width)
                .attr('x', imageX)
                .attr('y', imageY);
            }
            nodeImageShapeEnter.attr('stroke', nodeImageProperties.strokeColor)
                .attr('stroke-width', nodeImageProperties.strokeWidth)
                .attr('fill', 'none');
        }

        nodeImageEnter.append('image')
            .attr('xlink:href', (node: TreePointNode<any>) => {
                if (node.imageURL) {
                    return node.imageURL;
                } else {
                    return nodeImageProperties.defaultImageURL;
                }
            })
            .attr('width', nodeImageProperties.width)
            .attr('height', nodeImageProperties.height)
            .attr('x', imageX)
            .attr('y', imageY);
    }

    // http://bl.ocks.org/robschmuecker/7880033
    private _centerNode(node: TreePointNode<any>) {
        let t = zoomTransform(this.rootSVG.node() as Element);
        let x = -node.x;
        let y = -node.y;
        x = x * t.k + this.treeProperties.generalProperties.containerWidth / 2;
        y = y * t.k + this.treeProperties.generalProperties.containerHeight / 2;
        this.rootSVG.transition().duration(1000).call(this.rootSVGZoomListener.transform as any, zoomIdentity.translate(x,y).scale(t.k));
    }

    private _createNodeText() {

        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeProperties.textProperties;
        let nodeImageProperties: TreeNodeImageProperties = this.treeProperties.nodeProperties.imageProperties;
        let maxAllowedTextwidth = nodeTextProperties.maxAllowedWidth - nodeTextProperties.textPadding * 2;
        let textHeight: number = MeasureTextSize(this.textStyleProperties, this.treeNodes.data.name).height;

        let nodeTextEnter = this.nodesEnter
            .append('g')
            .classed('nodeText', true)
            .each((node: TreePointNode<any>, i: number, elements: Element[]) => {

                let nodeTextGroup = select(elements[i]);
                
                let nodeText = nodeTextGroup.append('text')
                    .attr('fill', nodeTextProperties.foregroundColor)
                    .style('dominant-baseline', 'middle')
                    .style('font-size', nodeTextProperties.fontSize)
                    .style('font-family', nodeTextProperties.fontFamily)
                    .style('font-weight', nodeTextProperties.fontWeight)
                    .style('font-style', nodeTextProperties.fontStyle)
                    .text((node: TreePointNode<any>) => {
                        return GetTailoredTextOrDefault(this.textStyleProperties, maxAllowedTextwidth, node.data.name);
                    });

                nodeTextGroup.append('title')
                    .text((node: TreePointNode<any>) => {
                        return node.data.name;
                    });

                let svgRect: SVGRect = (nodeText.node() as any).getBBox();

                if (nodeTextProperties.showTextInsideShape) {
                    if (nodeImageProperties.showImage) {

                        let textTransform = () => {
                            let x: number = 0;
                            let y: number = 0;
                            let maxAllowedY: number = 0;
                            let positiveX: number = 0;
                            let negativeX: number = 0;
                            let positiveY: number = 0;
                            let negativeY: number = 0;
                            if (nodeImageProperties.position == Position.Left) {
                                nodeText.style('text-anchor', 'start');
                                positiveX = this.nodeShapeWidth / 2 + nodeImageProperties.width + nodeTextProperties.textPadding;
                                negativeX = -this.nodeShapeWidth / 2 + nodeTextProperties.textPadding;
                                x = -this.nodeShapeWidth / 2 + nodeImageProperties.width + nodeImageProperties.xOffset + nodeTextProperties.textPadding;
                                x = ValidateBoundary(x, positiveX, negativeX); 
                            } else if (nodeImageProperties.position == Position.Right) {
                                nodeText.style('text-anchor', 'start');
                                x = -this.nodeShapeWidth / 2 + nodeTextProperties.textPadding;
                            } else if (nodeImageProperties.position == Position.Top) {
                                nodeText.style('text-anchor', 'middle');
                                positiveY = this.nodeShapeHeight / 2 + textHeight / 2 + nodeTextProperties.textPadding + nodeImageProperties.width;
                                negativeY = -this.nodeShapeHeight / 2 + textHeight / 2 + nodeTextProperties.textPadding;
                                y = -nodeImageProperties.yOffset + textHeight / 2 + nodeTextProperties.textPadding - (this.nodeShapeHeight / 2 - nodeImageProperties.height);
                                y = ValidateBoundary(y, positiveY, negativeY);
                            } else if (nodeImageProperties.position == Position.Bottom) {
                                nodeText.style('text-anchor', 'middle');
                                positiveY = this.nodeShapeHeight / 2 - textHeight / 2 - nodeTextProperties.textPadding;
                                negativeY = -this.nodeShapeHeight / 2 - textHeight / 2 - nodeTextProperties.textPadding - nodeImageProperties.height;
                                y = -nodeImageProperties.yOffset - textHeight / 2 - nodeTextProperties.textPadding + (this.nodeShapeHeight / 2 - nodeImageProperties.height);
                                console.log(y, positiveY, negativeY);
                                y = ValidateBoundary(y, positiveY, negativeY);
                            }
                            return Translate(x, y);
                        }

                        let getTailoredTextBasedOnImage = (node: TreePointNode<any>) => {
                            let tailoredText = '';
                            if (nodeImageProperties.position == Position.Left || nodeImageProperties.position == Position.Right) {
                                tailoredText =  GetTailoredTextOrDefault(
                                    this.textStyleProperties,
                                    this.nodeShapeWidth - nodeImageProperties.width + nodeImageProperties.xOffset - nodeTextProperties.textPadding * 2,
                                    node.data.name
                                );
                            } else if (nodeImageProperties.position == Position.Top || nodeImageProperties.position == Position.Bottom){
                                tailoredText = GetTailoredTextOrDefault(this.textStyleProperties, maxAllowedTextwidth, node.data.name);
                            }
                            return tailoredText;
                        }
                        nodeText.text(getTailoredTextBasedOnImage);
                        nodeTextGroup.attr('transform', textTransform);
                    } else {
                        nodeText.style('text-anchor', 'middle');
                        nodeTextGroup.attr('transform', Translate(0, 0));
                    }
                } else if (generalProperties.orientation == Orientation.Horizontal) {
                    nodeTextGroup.attr('transform', (node: TreePointNode<any>) => {
                        let x: number = 0;
                        let y: number = 0;
                        if (node.children) {
                            x = -(svgRect.width + nodeTextProperties.textPadding + nodeTextProperties.spaceBetweenNodeAndText + this.nodeShapeWidth / 2);
                        } else {
                            x = nodeTextProperties.textPadding + nodeTextProperties.spaceBetweenNodeAndText + this.nodeShapeWidth / 2;
                        }
                        return Translate(x, y);
                    });
                } else if(generalProperties.orientation == Orientation.Vertical) {
                    nodeTextGroup.attr('transform', (node: TreePointNode<any>) => {
                        let x = svgRect.width / 2;
                        let y = svgRect.height / 2 + nodeTextProperties.textPadding + nodeTextProperties.spaceBetweenNodeAndText + this.nodeShapeHeight / 2;
                        if (node.children) {
                            return Translate(-x, -y);
                        } else {
                            return Translate(-x, y);
                        }
                    });
                }

                if (nodeTextProperties.showBackground) {
                    let svgRect: SVGRect = (nodeText.node() as any).getBBox();
                    nodeTextGroup.insert('rect', 'text')
                        .attr('x', svgRect.x - nodeTextProperties.textPadding / 2)
                        .attr('y', svgRect.y - nodeTextProperties.textPadding / 2)
                        .attr('height', svgRect.height + nodeTextProperties.textPadding)
                        .attr('width', svgRect.width + nodeTextProperties.textPadding)
                        .attr('fill', nodeTextProperties.backgroundColor ? nodeTextProperties.backgroundColor : '#F2F2F2');
                }
                
            });
    }

    private _createNodeLinks() {

        let treeLinkProperties: TreeLinkProperties = this.treeProperties.linkProperties;
        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeAnimationDuration: number = this.treeProperties.nodeProperties.animationDuration;

        let horizontalCurveLink = linkHorizontal()
            .x((node: any) => { return node.x; })
            .y((node: any) => { return node.y; });
        let verticalCurveLink = linkVertical()
            .x((node: any) => { return node.x; })
            .y((node: any) => { return node.y; });

        let straightLink = (source: TreePointNode<any>, target: TreePointNode<any>) => {
            return "M" + source.x + "," + source.y +
                   "L" + target.x + "," + target.y;
        }

        let nodePerpendicularLineLength: number = 0;
        if (generalProperties.orientation == Orientation.Horizontal) {
            nodePerpendicularLineLength = this.nodeShapeWidth / 2 +(this.nodeShapeWidth + generalProperties.depthWiseHeight) * 0.4;
        } else {
            nodePerpendicularLineLength = this.nodeShapeHeight /2 + (this.nodeShapeHeight + generalProperties.depthWiseHeight) * 0.4;
        }
        let horizontalCornerLink = (source: TreePointNode<any>, target: TreePointNode<any>) => {
            return "M" + source.x + "," + source.y +
                   "H" + (source.x + nodePerpendicularLineLength) +
                   "V" + target.y +
                   "H" + target.x;
        }
        let verticalCornerLink = (source: TreePointNode<any>, target: TreePointNode<any>) => {
            return "M" + source.x + "," + source.y +
                   "V" + (source.y + nodePerpendicularLineLength) +
                   "H" + target.x +
                   "V" + target.y;
        }

        let createPath = (nodeLink: HierarchyPointLink<any>) => {
            if (treeLinkProperties.treeNodeLinkType == LineType.Curved) {
                if (generalProperties.orientation == Orientation.Horizontal) {
                    return horizontalCurveLink(nodeLink as any);
                } else {
                    return verticalCurveLink(nodeLink as any);
                }
            } else if (treeLinkProperties.treeNodeLinkType == LineType.Straight) {
                return straightLink(nodeLink.source, nodeLink.target);
            } else if (treeLinkProperties.treeNodeLinkType == LineType.Corner) {
                if (generalProperties.orientation == Orientation.Horizontal) {
                    return horizontalCornerLink(nodeLink.source, nodeLink.target);
                } else {
                    return verticalCornerLink(nodeLink.source, nodeLink.target);
                }
            }
        }

        let nodeLinks: d3.Selection<d3.BaseType, any, any, any> = this.treeGroup.selectAll('path.link')
            .data(this.treeDataLinks, (nodeLink: HierarchyPointLink<any>) => {
                return (nodeLink.source.data.name + nodeLink.target.data.name + nodeLink.source.x + nodeLink.target.y);
            });
            
        let nodeLinksEnter = nodeLinks.enter()
            .insert("path", "g")   //will insert path before g elements
            .classed('link', true)
            .attr('fill', 'none')
            .attr('stroke', treeLinkProperties.strokeColor)
            .attr('stroke-width', treeLinkProperties.strokeWidth)
            .attr('d', createPath);

        nodeLinksEnter.append('title')
            .text((nodeLink: HierarchyPointLink<any>) => {
                return nodeLink.source.data.name + " -> " + nodeLink.target.data.name;
            });


        if (treeLinkProperties.animation) {
            nodeLinksEnter.each((nodeLink: HierarchyPointLink<any>, i: number, elements: Element[]) => {
                let linkLength = (elements[i] as any).getTotalLength();
                select(elements[i])
                    .attr('stroke-dasharray', linkLength + " " + linkLength)
                    .attr("stroke-dashoffset", linkLength)
                    .transition()
                    .delay(nodeAnimationDuration - (nodeAnimationDuration / 3))
                    .duration(treeLinkProperties.animationDuration)
                    // .ease(d3_ease.easeCubicIn)
                    .attr("stroke-dashoffset", 0);
            });

            nodeLinks.attr('stroke-dasharray', '')
                .attr("stroke-dashoffset", 0)
                .transition()
                .duration(treeLinkProperties.animationDuration)
                .attr('d', createPath);

            nodeLinks.exit()
                .each((nodeLink: HierarchyPointLink<any>, i: number, elements: Element[]) => {
                    let linkLength = (elements[i] as any).getTotalLength();
                    select(elements[i])
                        .attr('stroke-dasharray', linkLength + " " + linkLength)
                        .attr("stroke-dashoffset", 0)
                        .attr('opacity', 1)
                        .transition()
                        .duration(treeLinkProperties.animationDuration)
                        // .ease(d3_ease.easeCubicIn)
                        .attr("stroke-dashoffset", linkLength)
                        .attr('opacity', 0)
                        .remove();
                });
        } else {
            nodeLinks.attr('stroke-dasharray', '')
                .attr("stroke-dashoffset", 0)
                .attr('d', createPath);

            nodeLinks.exit().remove();
        }
    }
}
