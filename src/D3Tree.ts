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
import { SVGUtils, TextProperties } from './Utils';
import { linkHorizontal, linkVertical } from 'd3-shape';
import { Selection, select, BaseType, event } from 'd3-selection';
import { zoom, zoomIdentity, ZoomBehavior, zoomTransform } from 'd3-zoom';
import { max } from 'd3-array';
import * as d3_ease from 'd3-ease';
import 'd3-transition';

//svgutils
let Translate = SVGUtils.Translate;
let MeasureTextSize = SVGUtils.MeasureTextSize;
let GetTailoredTextOrDefault = SVGUtils.GetTailoredTextOrDefault;

export class D3Tree {

    private treeGroup: Selection<BaseType, any, any, any>; // Holds the parent group element of the tree.
    private tree: TreeLayout<any>; // Holds defination of funtion to create tree layout based on given tree type, size and hierarhcy data.
    private hierarchyData: HierarchyNode<any>; // Holds hierarchy data which gives information such as depth and height of the nodes and other info.
    private treeNodes: TreePointNode<any>; // Holds tree data created from treeMap and hierarchyData with info such as x and y coordinate of the node.
    private treeNodeArray: TreePointNode<any>[]; // Holds nodes in form of array in chronological order from top to bottom.
    private treeDataLinks: HierarchyPointLink<any>[]; // Holds defination of links between nodes.
    private dynamicHeightAndWidth: boolean = false; // enable zoom when there is no treeheight and width is provided.
    private maxExpandedDepth: number; // will store max depth of tree visible on screen
    private rootSVGZoomListner: ZoomBehavior<Element, {}>;
    private nodeUID = 0; // Used to uniquely identify nodes in tree and it will be used by d3 data joins for enter, update and exit

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
     * Call this funtion which will create initial tree structure based on `generalProperties` specified in
     * `treeProperties` in constructor.
     */
    CreateTree() {

        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeProperties.shapeProperties;
        let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeProperties.textProperties;

        // set maxExpandedDepth to defaultMaxDepth
        this.maxExpandedDepth = generalProperties.defaultMaxDepth;

        // Generate hierarchy data which gives depth, height and other info.
        this.hierarchyData = hierarchy(this.data, (treeDatum: TreeData) => {
            return treeDatum.children;
        });

        /**
         * Recursive funtion used to collapse tree nodes based on defaultMaxDepth property of generalSettings.
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
        if (nodeShapeProperties.shapeType == ShapeType.circle) {
            this.nodeShapeHeight = this.nodeShapeWidth = 2 * nodeShapeProperties.circleRadius;
        } else if (nodeShapeProperties.shapeType == ShapeType.rect) {
            this.nodeShapeHeight = nodeShapeProperties.rectHeight;
            this.nodeShapeWidth = nodeShapeProperties.rectWidth;
        }

        // if text needs to be shown inside the shape then we set `maxAllowedWidth` of text properties to size of node
        if (nodeTextProperties.showTextInsideShape) {
            nodeTextProperties.maxAllowedWidth = this.nodeShapeWidth;
        }

        // only add zoom when no fixed treeheight and treewidth is provided.
        if (generalProperties.enableZoom) {
            this.dynamicHeightAndWidth = true;
            // this.rootSVG.style('cursor', 'grab')
        }

        this._updateTree(); // update the tree if already created or make a new tree.
        if (this.dynamicHeightAndWidth) {
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
        if (generalProperties.extraPerLevelDepth == undefined) {
            generalProperties.extraPerLevelDepth = 0;
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
        if (nodeTextProperties.textPadding == undefined || !nodeTextProperties.showBackground) {
            if (nodeTextProperties.showBackground || nodeTextProperties.showTextInsideShape) {
                nodeTextProperties.textPadding = 4;
            } else {
                nodeTextProperties.textPadding = 0;
            }
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
            nodeImageProperties.shape = ShapeType.none;
        }
        if (nodeImageProperties.position == undefined) {
            nodeImageProperties.position = Position.left;
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

        // if dynaimicHeightSndWidth is true,s that means no treeheight or treewidth is provided
        // than we calculate it according to the tree data.
        let treeHeight;
        let treeWidth;
        let textProperties: TextProperties = {
            'fontFamily': nodeTextProperties.fontFamily,
            'fontSize': nodeTextProperties.fontSize,
            'fontStyle': nodeTextProperties.fontStyle,
            'fontWeight': nodeTextProperties.fontWeight
        }

        if (this.dynamicHeightAndWidth) {

            // Find longest text width present in tree to calculate proper spacing between nodes.
            if (nodeTextProperties.showTextInsideShape) {
                treeWidth = (this.nodeShapeWidth + generalProperties.extraPerLevelDepth) * (this.maxExpandedDepth + 1);
                if (generalProperties.orientation == Orientation.horizontal) {
                    treeHeight = this.hierarchyData.leaves().length * (this.nodeShapeHeight + generalProperties.extraSpaceBetweenNodes);
                } else {
                    treeHeight = this.hierarchyData.leaves().length * (this.nodeShapeWidth + generalProperties.extraSpaceBetweenNodes);
                }
            } else {
                let maxTextWidth = 0;
                let findMaxTextLength = (level: number, node: any) => {
                    let textWidth = MeasureTextSize(textProperties, node.data.name).width;  
                    if (node.children && node.children.length > 0 && level < this.maxExpandedDepth) {
                        node.children.forEach((element) => {
                            findMaxTextLength(level + 1, element);
                        });
                    }
                    maxTextWidth = Math.max(textWidth, maxTextWidth);
                };
                findMaxTextLength(0, this.hierarchyData);

                let textHeight = MeasureTextSize(textProperties, this.hierarchyData.data.name).height + nodeTextProperties.textPadding;

                // if node shape size is greater than text height than use that for treeHeight calculation
                let perNodeHeight: number = textHeight > this.nodeShapeHeight ? textHeight : this.nodeShapeHeight + generalProperties.extraSpaceBetweenNodes;
                let perNodeWidth: number = 0;
                perNodeWidth = nodeTextProperties.maxAllowedWidth + nodeTextProperties.textPadding * 2;
                treeWidth = (maxTextWidth + generalProperties.extraPerLevelDepth) * (this.maxExpandedDepth + 1);
                if (generalProperties.orientation == Orientation.horizontal) {
                    treeHeight = this.hierarchyData.leaves().length * perNodeHeight;
                } else {
                    treeHeight = this.hierarchyData.leaves().length * perNodeWidth;
                }
            }

            // zoom will chnage transform of group element which is child of root SVG and parent of tree
            let treeGroupZoomAction = () => {      
                this.treeGroup.attr('transform', event.transform);
                // this.rootSVG.style('cursor', 'grab');
            }

            // listner will be attached to root SVG.
            this.rootSVGZoomListner = zoom().scaleExtent([generalProperties.minZoomScale, generalProperties.maxZoomScale])
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
            
            this.rootSVG.call(this.rootSVGZoomListner)
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
            let rootNodeTextSize = MeasureTextSize(textProperties, this.hierarchyData.data.name);
            if (generalProperties.orientation == Orientation.horizontal) {
                let maxLeaveNodesTextWidth = 0;
                let rootNodeWidth = 0;
                let fixedNodeWidth = nodeTextProperties.textPadding + nodeTextProperties.spaceBetweenNodeAndText + this.nodeShapeWidth / 2;

                if (nodeTextProperties.showTextInsideShape) {
                    rootNodeWidth = this.nodeShapeWidth / 2;
                } else {
                    rootNodeWidth = rootNodeTextSize.width + fixedNodeWidth;
                }

                this.hierarchyData.leaves().forEach((node: TreePointNode<any>) => {
                    let textWidth = MeasureTextSize(textProperties, node.data.name).width;
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
            this.tree =  cluster().size([treeHeight, treeWidth]);
        } else {
            this.tree =  tree().size([treeHeight, treeWidth]);
        }

        // get final data
        this.treeNodes = this.tree(this.hierarchyData);
        this.treeNodeArray = this.treeNodes.descendants();

        // if orientation is horizontal than swap the x and y
        if (generalProperties.orientation == Orientation.horizontal) {
            this.treeNodeArray.forEach((node) => {
                node.x = node.x + node.y;
                node.y = node.x - node.y;
                node.x = node.x - node.y;
            });
        }

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
            if (this.dynamicHeightAndWidth) {
                // finding maximum expanded depth for dynamic height calculation.
                this.maxExpandedDepth = max(this.hierarchyData.leaves().map((node) => { return node.depth }));
            }
            this._updateTree();
            if (this.dynamicHeightAndWidth) {
                this._centerNode(node);
            }
        }

        let nodeShape;
        if (nodeShapeProperties.shapeType == ShapeType.circle) {
            nodeShape = this.nodesEnter.append('circle')
                .attr('r', nodeShapeProperties.circleRadius)
        } else if (nodeShapeProperties.shapeType == ShapeType.rect) {
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
            let maxAllowedX:number = 0;
            if (!this.treeProperties.nodeProperties.textProperties.showTextInsideShape) {
                x = -nodeImageProperties.width / 2;
            } else if (nodeImageProperties.position == Position.left) {
                x = -this.nodeShapeWidth / 2 + nodeImageProperties.xOffset;
                maxAllowedX = nodeImageProperties.width + this.nodeShapeWidth / 2;
                if (Math.abs(x) > maxAllowedX) {
                    x = -maxAllowedX;
                    // console.log('too much x offest not allowed');
                }
            } else if (nodeImageProperties.position == Position.right) {
                x = this.nodeShapeWidth / 2 - nodeImageProperties.width + nodeImageProperties.xOffset;
                maxAllowedX = this.nodeShapeWidth / 2;
                if (Math.abs(x) > maxAllowedX) {
                    x = maxAllowedX;
                    // console.log('too much x offest not allowed');
                }
            }  
            return x;
        }

        let imageY = () => {
            let y: number;
            if (nodeImageProperties.position == Position.left || nodeImageProperties.position == Position.right) {
                y = -nodeImageProperties.height / 2;
            }

            return y;
        }

        if (nodeImageProperties.shape == ShapeType.circle) {
            nodeImageEnter.append('circle')
            .attr('r', () => {
                return nodeImageProperties.height / 2;
            })
            .attr('fill', 'none')
            .attr('stroke', nodeImageProperties.strokeColor)
            .attr('stroke-width', nodeImageProperties.strokeWidth)
            .attr('cx', imageX() + nodeImageProperties.width / 2)
            .attr('cy', 0);
        } else if (nodeImageProperties.shape == ShapeType.rect) {
            nodeImageEnter.append('rect')
            .attr('height', nodeImageProperties.height)
            .attr('width', nodeImageProperties.width)
            .attr('fill', 'none')
            .attr('stroke', nodeImageProperties.strokeColor)
            .attr('stroke-width', nodeImageProperties.strokeWidth)
            .attr('x', imageX)
            .attr('y', imageY);
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
        this.rootSVG.transition().duration(1000).call(this.rootSVGZoomListner.transform as any, zoomIdentity.translate(x,y).scale(t.k));
    }

    private _createNodeText() {

        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeProperties.textProperties;
        let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeProperties.shapeProperties;
        let nodeImageProperties: TreeNodeImageProperties = this.treeProperties.nodeProperties.imageProperties;
        let textProperties: TextProperties = {
            fontFamily: nodeTextProperties.fontFamily,
            fontSize: nodeTextProperties.fontSize,
            fontStyle: nodeTextProperties.fontStyle,
            fontWeight: nodeTextProperties.fontWeight
        };
        let maxAllowedTextwidth = nodeTextProperties.maxAllowedWidth - nodeTextProperties.textPadding * 2;

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
                        textProperties.text = node.data.name;
                        return GetTailoredTextOrDefault(textProperties, maxAllowedTextwidth);
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
                            if (nodeImageProperties.position == Position.left) {
                                x = -this.nodeShapeWidth / 2 + nodeImageProperties.width + nodeImageProperties.xOffset + nodeTextProperties.textPadding;
                                y = 0;
                            } else if (nodeImageProperties.position == Position.right) {
                                x = -this.nodeShapeWidth / 2 + nodeTextProperties.textPadding + nodeTextProperties.textPadding;
                                y = 0;
                            }
                            return Translate(x, y);
                        }

                        let getTailoredTextBasedOnImage = (node: TreePointNode<any>) => {
                            let tailoredText = '';
                            textProperties.text = node.data.name;
                            if (nodeImageProperties.position == Position.left) {
                                tailoredText =  GetTailoredTextOrDefault(
                                    textProperties,
                                    this.nodeShapeWidth - nodeImageProperties.width + Math.abs(nodeImageProperties.xOffset) - nodeTextProperties.textPadding
                                );
                            } else if (nodeImageProperties.position == Position.right) {
                                tailoredText =  GetTailoredTextOrDefault(
                                    textProperties,
                                    this.nodeShapeWidth - nodeImageProperties.width + nodeImageProperties.xOffset - nodeTextProperties.textPadding
                                );
                            }
                            return tailoredText;
                        }
                        nodeText.style('text-anchor', 'start')
                            .text(getTailoredTextBasedOnImage);
                        nodeTextGroup.attr('transform', textTransform);
                    } else {
                        nodeText.style('text-anchor', 'middle');
                        nodeTextGroup.attr('transform', Translate(0, 0));
                    }
                } else if (generalProperties.orientation == Orientation.horizontal) {
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
                } else if(generalProperties.orientation == Orientation.vertical) {
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

                if (nodeTextProperties.showBackground && !nodeTextProperties.showTextInsideShape) {
                    nodeTextGroup.insert('rect', 'text')
                        .attr('x', svgRect.x - nodeTextProperties.textPadding / 2)
                        .attr('y', svgRect.y - nodeTextProperties.textPadding / 2)
                        .attr('height', svgRect.height + nodeTextProperties.textPadding)
                        .attr('width', svgRect.width + nodeTextProperties.textPadding)
                        .attr('fill', nodeTextProperties.backgroundColor ? nodeTextProperties.backgroundColor : '#F2F2F2');
                }
                

                // select(elements[i]).attr('transform', Translate(10, 0));


                // console.log(elements[i]);
                
            });
        
        // nodeTextEnter.append('text')
        //     .attr('fill', nodeTextProperties.foregroundColor)
        //     .style('dominant-baseline', 'middle')
        //     .style('font-size', nodeTextProperties.fontSize)
        //     .style('font-family', nodeTextProperties.fontFamily)
        //     .style('font-weight', nodeTextProperties.fontWeight)
        //     .style('font-style', nodeTextProperties.fontStyle);

        // if (generalProperties.orientation == TreeOrientation.vertical) {
        //     this._createNodeTextForVerticalTree(nodeTextEnter);
        // } else {
        //     this._createNodeTextForHorizontalTree(nodeTextEnter);
        // }


        // if (nodeTextProperties.showBackground) {
        //     this.nodesEnter.selectAll('g.nodeText')
        //         .insert('rect', 'text')
        //         .each((d, i, elements) => {
        //             let svgRect: SVGRect = (elements[i] as any).parentNode.getBBox();
        //             select(elements[i])
        //                 .attr('x', svgRect.x - nodeTextProperties.textPadding / 2)
        //                 .attr('y', svgRect.y - nodeTextProperties.textPadding / 2)
        //                 .attr('height', svgRect.height + nodeTextProperties.textPadding)
        //                 .attr('width', svgRect.width + nodeTextProperties.textPadding)
        //                 .attr('fill', nodeTextProperties.backgroundColor ? nodeTextProperties.backgroundColor : '#F2F2F2');
        //         });
        // }
    }

    private _createNodeTextForHorizontalTree(nodeTextEnter: Selection<BaseType, TreePointNode<any>, BaseType, any>) {

        // let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;
        // let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeTextProperties;


        // nodeTextEnter.selectAll('text')
        //     .attr('x', adjustXValue)
        //     .style('text-anchor', (node: TreePointNode<any>) => {
        //         let textAnchor = node.children ? 'end': 'start';
        //         return textAnchor;
        //     })
        //     .text((node: any) => {
        //         return node.data.name;
        //     });

        // this.nodes.select('g.nodeText').select('text')
        //     .attr('x', adjustXValue);
        
        
        // let nodeTexts = this.treeGroup.selectAll('text.nodeText')
        //     .data(this.treeDataArray)
        //     .enter()
        //     .append('g')
        //     .attr('transform', (d:any) => {
        //         let translate = d.children ? Translate(d.y - nodeShapeProperties.size - 8, d.x) :
        //             Translate(d.y + nodeShapeProperties.size + 8, d.x);
        //         return translate;
        //     });

        // nodeTexts.append('text')
        //     .attr('fill', nodeTextProperties.foregroundColor)
        //     .style('dominant-baseline', 'central')
        //     .text((d: any) => {
        //         return d.data.name;
        //     });

        // nodeTexts.style('text-anchor', (d: any, i, elements) => {
        //         let textAnchor = d.children ? 'end': 'start';
        //         return textAnchor;
        //     });

        // nodeTexts.append('title')
        //     .text((d: any) => {
        //         return d.data.name;
        //     });

        // if (nodeTextProperties.enableBackground) {
        //     nodeTexts.insert('rect', 'text')
        //     .each((d, i, elements) => {
        //         let svgRect: SVGRect = (elements[i] as any).parentNode.getBBox();
        //         select(elements[i])
        //             .attr('x', svgRect.x - 2)
        //             .attr('y', svgRect.y - 2)
        //             .attr('height', svgRect.height + 4)
        //             .attr('width', svgRect.width + 4)
        //             .attr('fill', nodeTextProperties.backgroundColor ? nodeTextProperties.backgroundColor : '#F2F2F2');
        //     });
        // }
    }

    private _createNodeTextForVerticalTree(nodeTextEnter: Selection<BaseType, TreePointNode<any>, BaseType, any>) {

        // let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;
        // let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeTextProperties;

        // let textProperties: TextProperties = {
        //     'fontFamily': nodeTextProperties.fontFamily,
        //     'fontSize': nodeTextProperties.fontSize
        // };
        
        // let maxAllowedTextwidth = nodeTextProperties.maxAllowedWidth - (nodeTextProperties.showBackground ? nodeTextProperties.textPadding * 2 : 0);
        // nodeTextEnter.selectAll('text')
        //     .attr('y', (node: TreePointNode<any>) => {
        //         let totalSpacing = 0;
        //         let backgroundSpacing = nodeTextProperties.showBackground ? nodeTextProperties.textPadding / 2: 0;
        //         if (node.children) {
        //             totalSpacing = -this.nodeShapeHeight - nodeTextProperties.spaceBetweenNodeAndText - backgroundSpacing;
        //         } else {
        //             totalSpacing = this.nodeShapeHeight + nodeTextProperties.spaceBetweenNodeAndText * 2 + backgroundSpacing;
        //         }
        //         return totalSpacing;
        //     })
        //     .style('text-anchor', 'middle')
        //     .text((node: TreePointNode<any>) => {
        //         textProperties.text = node.data.name;
        //         return GetTailoredTextOrDefault(textProperties, maxAllowedTextwidth);
        //     });

        // let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;
        // let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeTextProperties;

        // let nodeTexts = this.treeGroup.selectAll('text.nodeText')
        //     .data(this.treeDataArray)
        //     .enter()
        //     .append('g')
        //     .attr('transform', (d:any) => {
        //         return Translate(d.x + nodeShapeProperties.size + 8, d.y)
        //     });

        // nodeTexts.append('text')
        //     .attr('fill', nodeTextProperties.foregroundColor)
        //     .style('dominant-baseline', 'central')
        //     .text((d: any) => {
        //         return d.data.name;
        //     });

        // nodeTexts.style('text-anchor', (d: any, i, elements) => {
        //     let textWidth: number = (elements[i] as any).getBBox().width;
        //     let textAnchor = (textWidth < nodeShapeProperties.size) ? 'middle' : 'start';
        //     return textAnchor;
        // });

        // nodeTexts.append('title')
        //     .text((d: any) => {
        //         return d.data.name;
        //     });

        // if (nodeTextProperties.showBackground) {
        //     nodeTexts.insert('rect', 'text')
        //     .each((d, i, elements) => {
        //         let svgRect: SVGRect = (elements[i] as any).parentNode.getBBox();
        //         select(elements[i])
        //             .attr('x', svgRect.x - 2)
        //             .attr('y', svgRect.y - 2)
        //             .attr('height', svgRect.height + 4)
        //             .attr('width', svgRect.width + 4)
        //             .attr('fill', nodeTextProperties.backgroundColor ? nodeTextProperties.backgroundColor : '#F2F2F2');
        //     });
        // }
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
        if (generalProperties.orientation == Orientation.horizontal) {
            nodePerpendicularLineLength = this.nodeShapeWidth / 2 +(this.nodeShapeWidth + generalProperties.extraPerLevelDepth) * 0.4;
        } else {
            nodePerpendicularLineLength = this.nodeShapeHeight /2 + (this.nodeShapeHeight + generalProperties.extraPerLevelDepth) * 0.4;
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
            if (treeLinkProperties.treeNodeLinkType == LineType.curved) {
                if (generalProperties.orientation == Orientation.horizontal) {
                    return horizontalCurveLink(nodeLink as any);
                } else {
                    return verticalCurveLink(nodeLink as any);
                }
            } else if (treeLinkProperties.treeNodeLinkType == LineType.straight) {
                return straightLink(nodeLink.source, nodeLink.target);
            } else if (treeLinkProperties.treeNodeLinkType == LineType.corner) {
                if (generalProperties.orientation == Orientation.horizontal) {
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
