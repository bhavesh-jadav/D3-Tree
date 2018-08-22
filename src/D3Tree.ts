import { 
    TreeGeneralProperties, TreeNodeLinkProperties, TreeNodeTextProperties,
    TreeProperties, TreeNodeShapeProperties, TreeNodeShapeTypes,
    TreeOrientation, TreeNodeLinkTypes, TreePointNode, TreeData
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
    // holds all nodes selection i.e. nodes that needs to be created, updated or removed.
    private nodes: Selection<BaseType, TreePointNode<any>, BaseType, any>;
    // holds all nodes that needs to created.
    private nodesEnter: Selection<BaseType, TreePointNode<any>, BaseType, any>;
    private nodeShapeSize: number; // in case of circle 2*nodeShapeProperties.size, in case of square nodeShapeProperties.size

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
     * Call this funtion wich will create initial tree structure based on generalProperties specified in
     * treeProperties in constructor
     */
    CreateTree() {

        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;

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

        // calculate node size for spacing purpose.
        if (nodeShapeProperties.shapeType == TreeNodeShapeTypes.circle) {
            this.nodeShapeSize = 2 * nodeShapeProperties.size;
        } else {
            this.nodeShapeSize = nodeShapeProperties.size;
        }

        // only add zoom when no fixed treeheight and treewidth is provided.
        if (generalProperties.treeHeight == undefined && generalProperties.treeWidth == undefined) {
            this.dynamicHeightAndWidth = true;
        }

        this._updateTree(); // update the tree if already created or make a new tree.
        if (this.dynamicHeightAndWidth) {
            this._centerNode(this.treeNodes); // center the root node.
        }
    }

    /**
     * Updates the tree such as updating nodes, nodes shapes, node links etc.
     */
    private _updateTree() {
        this._createTreeData();
        this._createNodeGroups();
        this._createNodes();
        this._createNodeLinks();
        this._createNodeText();
    }

    private _setDefaultValuesForTreeProperties() {
        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;
        let nodeLinkProperties: TreeNodeLinkProperties = this.treeProperties.nodeLinkProperties;
        let nodeTextproperties: TreeNodeTextProperties = this.treeProperties.nodeTextProperties;

        // general properties
        if (generalProperties.isClusterLayout == undefined) {
            generalProperties.isClusterLayout = false;
        }
        if (generalProperties.extraDepthWiseHeight == undefined) {
            generalProperties.extraDepthWiseHeight = 0;
        }

        // node shape properties
        if (nodeShapeProperties.animationDuration == undefined) {
            nodeShapeProperties.animationDuration = 1000;
        }

        // node link properties
        if (nodeLinkProperties.animationDuration == undefined) {
            nodeLinkProperties.animationDuration = 1000;
        }

        // node text properties
        if (nodeTextproperties.backgroundColor == undefined) {
            nodeTextproperties.backgroundColor = '#F2F2F2';
        }
        if (nodeTextproperties.fontWeight == undefined) {
            nodeTextproperties.fontWeight = 'normal';
        }
        if (nodeTextproperties.fontStyle == undefined) {
            nodeTextproperties.fontStyle = 'normal';
        }
        if (nodeTextproperties.spaceBetweenNodeAndText == undefined) {
            nodeTextproperties.spaceBetweenNodeAndText = 5;
        }
        if (nodeTextproperties.maxAllowedWidth == undefined) {
            nodeTextproperties.maxAllowedWidth = 50;
        }
        if (nodeTextproperties.textPadding == undefined) {
            if (nodeTextproperties.showBackground) {
                nodeTextproperties.textPadding = 4;
            } else {
                nodeTextproperties.textPadding = 0;
            }
        }
    }

    /**
     * Creates D3 tree data based on json data provided in constructor
     */
    private _createTreeData() {

        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeTextProperties;

        

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
            
            // Find depth wise max children count to calculate proper tree height.
            // base code credit: http://bl.ocks.org/robschmuecker/7880033
            // let depthWiseChildrenCount: number[] = [1];
            // let countDepthwiseChildren = (level: number, node: any) => {
            //     if (node.children && node.children.length > 0 && level < this.maxExpandedDepth) {
            //         if (depthWiseChildrenCount.length <= level + 1) depthWiseChildrenCount.push(0);
            //         depthWiseChildrenCount[level + 1] += node.children.length;
            //         node.children.forEach((d) => {
            //             countDepthwiseChildren(level + 1, d);
            //         });
            //     }
            // };
            // countDepthwiseChildren(0, this.hierarchyData);

            // Find longest text width present in tree to calculate proper spacing between nodes.
            let maxTextWidth = 0;
            let findMaxLabelLength = (level: number, node: any) => {
                let textWidth = MeasureTextSize(textProperties, node.data.name).width;  
                if (node.children && node.children.length > 0 && level < this.maxExpandedDepth) {
                    node.children.forEach((element) => {
                        findMaxLabelLength(level + 1, element);
                    });
                }
                maxTextWidth = Math.max(textWidth, maxTextWidth);
            };
            findMaxLabelLength(0, this.hierarchyData);

            let textHeight = MeasureTextSize(textProperties, this.hierarchyData.data.name).height + 
                (nodeTextProperties.showBackground ? nodeTextProperties.textPadding * 2 : 0);

            // if node shape size is greater than text height than use that for treeHeight calculation
            let perNodeHeight = textHeight > this.nodeShapeSize ? textHeight : this.nodeShapeSize;
            let maxPerNodeTextWidth = nodeTextProperties.maxAllowedWidth + (nodeTextProperties.showBackground ? nodeTextProperties.textPadding * 2 : 0);
            treeWidth = (maxTextWidth + generalProperties.extraDepthWiseHeight) * (this.maxExpandedDepth + 1);
            if (generalProperties.orientation == TreeOrientation.horizontal) {
                treeHeight = this.hierarchyData.leaves().length * perNodeHeight;
            } else {
                treeHeight = this.hierarchyData.leaves().length * maxPerNodeTextWidth;
            }

            // adding zoom to tree.
            let minZoomScale = Math.min(
                generalProperties.containerHeight / generalProperties.treeHeight,
                generalProperties.containerWidth / generalProperties.treeWidth
            );
            minZoomScale = minZoomScale - (minZoomScale * 0.05);
            // zoom will chnage transform of group element which is child of root SVG and parent of tree
            let treeGroupZoomAction = () => {
                this.treeGroup.attr('transform', event.transform);
            }

            // settings max translate extent for zooming
            // let maxTranslateX = generalProperties.containerWidth - (generalProperties.treeWidth * minZoomScale);
            // let maxTranslateY = generalProperties.containerHeight - (generalProperties.treeHeight * minZoomScale);

            // listner will be attached to root SVG.
            this.rootSVGZoomListner = zoom().scaleExtent([minZoomScale, 3])
                // .translateExtent([[0, 0], [generalProperties.containerWidth, generalProperties.containerHeight]])
                .on('zoom', treeGroupZoomAction)
                .filter(() => {
                    return (
                        (event as MouseEvent).button == 1 ||
                        event instanceof WheelEvent
                    );
                });
            this.rootSVG.call(this.rootSVGZoomListner);
        } else {
            let maxLeaveNodesTextWidth = 0;
            let rootNodeTextWidth = MeasureTextSize(textProperties, this.hierarchyData.data.name).width +
                nodeTextProperties.textPadding + nodeTextProperties.spaceBetweenNodeAndText + this.nodeShapeSize / 2;

            this.hierarchyData.leaves().forEach((node: TreePointNode<any>) => {
                let textWidth = MeasureTextSize(textProperties, node.data.name).width;

                maxLeaveNodesTextWidth = Math.max(textWidth, maxLeaveNodesTextWidth);
            });
            maxLeaveNodesTextWidth += nodeTextProperties.textPadding;
            treeHeight = generalProperties.treeHeight;
            treeWidth = generalProperties.treeWidth - (rootNodeTextWidth + maxLeaveNodesTextWidth + nodeTextProperties.spaceBetweenNodeAndText);
            console.log(treeWidth);
            
            this.treeGroup.transition()
                .duration(1000)
                .attr('transform', Translate(rootNodeTextWidth, 0));
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
        if (generalProperties.orientation == TreeOrientation.horizontal) {
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
    }

    private _createNodes() {
        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;
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

        if (nodeShapeProperties.shapeType == TreeNodeShapeTypes.circle) {
            this.nodesEnter.append('circle')
                .attr('r', nodeShapeProperties.size)
                .attr('stroke', nodeShapeProperties.stroke)
                .attr('stroke-width', nodeShapeProperties.strokeWidth);
        } else if (nodeShapeProperties.shapeType == TreeNodeShapeTypes.square) {
            let squareTransformXY = 0 - nodeShapeProperties.size / 2;
            this.nodesEnter.append('rect')
                .attr('x', squareTransformXY)
                .attr('y', squareTransformXY)
                .attr('height', nodeShapeProperties.size)
                .attr('width', nodeShapeProperties.size)
                .attr('stroke', nodeShapeProperties.stroke)
                .attr('stroke-width', nodeShapeProperties.strokeWidth);
        }

        this.nodesEnter.attr('fill', (node: TreePointNode<any>) => {
                return node._children ? nodeShapeProperties.collapsedNodeColor : nodeShapeProperties.expandedNodeColor;
            })
            .on('click', click);
        this.nodesEnter.append('title')
            .text((node: TreePointNode<any>) => {
                return node.data.name;
            });
    
        if (nodeShapeProperties.animation) {
            this.nodesEnter.attr('opacity', 0)
                .transition()
                .duration(nodeShapeProperties.animationDuration)
                .ease(d3_ease.easeCubicOut)
                .attr('opacity', 1);

            this.nodes.transition()
                .duration(nodeShapeProperties.animationDuration)
                .attr('transform', (node: TreePointNode<any>) => {
                    return Translate(node.x, node.y);
                })
                .attr('fill', (node: any) => {
                    return node._children ? nodeShapeProperties.collapsedNodeColor : nodeShapeProperties.expandedNodeColor;
                });

            this.nodes.exit()
                .attr('opacity', 1)
                .transition()
                .duration(nodeShapeProperties.animationDuration)
                .ease(d3_ease.easeCubicOut)
                .attr('opacity', 0)
                .remove();
        } else {
            this.nodesEnter.attr('opacity', 1);

            this.nodes.attr('transform', (node: TreePointNode<any>) => {
                    return Translate(node.x, node.y);
                });

            this.nodes.exit().remove();
        }
    }

    // http://bl.ocks.org/robschmuecker/7880033
    private _centerNode(node: TreePointNode<any>) {
        let t = zoomTransform(this.rootSVG.node() as Element);
        let x = -node.x;
        let y = -node.y;
        x = x * t.k + this.treeProperties.generalProperties.containerWidth / 2;
        y = y * t.k + this.treeProperties.generalProperties.containerHeight / 2;
        this.rootSVG.transition().duration(1000).call(this.rootSVGZoomListner.transform as any, zoomIdentity.translate(x,y).scale(t.k) );
    }

    private _createNodeText() {

        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeTextProperties;

        let adjustXValue = (node: TreePointNode<any>) => {
            if (node.children) {
                return -this.nodeShapeSize - nodeTextProperties.spaceBetweenNodeAndText;
            } else {
                return this.nodeShapeSize + nodeTextProperties.spaceBetweenNodeAndText;
            }
        }


        let nodeTextEnter = this.nodesEnter
            .append('g')
            .classed('nodeText', true)
            .each((node: TreePointNode<any>, i: number, elements: Element[]) => {

                let nodeTextGroup = select(elements[i]);

                nodeTextGroup.append('text')
                    .attr('fill', nodeTextProperties.foregroundColor)
                    .style('dominant-baseline', 'middle')
                    .style('font-size', nodeTextProperties.fontSize)
                    .style('font-family', nodeTextProperties.fontFamily)
                    .style('font-weight', nodeTextProperties.fontWeight)
                    .style('font-style', nodeTextProperties.fontStyle)
                    // .attr('x', adjustXValue)
                    // .style('text-anchor', (node: TreePointNode<any>) => {
                    //     let textAnchor = node.children ? 'end': 'start';
                    //     return textAnchor;
                    // })
                    .text((node: any) => {
                        return node.data.name;
                    });

                nodeTextGroup.append('title')
                    .text((node: TreePointNode<any>) => {
                        return node.data.name;
                    });

                let svgRect: SVGRect = (nodeTextGroup.select('text').node() as any).getBBox();
                if (nodeTextProperties.showBackground) {
                    nodeTextGroup.insert('rect', 'text')
                        .attr('x', svgRect.x - nodeTextProperties.textPadding / 2)
                        .attr('y', svgRect.y - nodeTextProperties.textPadding / 2)
                        .attr('height', svgRect.height + nodeTextProperties.textPadding)
                        .attr('width', svgRect.width + nodeTextProperties.textPadding)
                        .attr('fill', nodeTextProperties.backgroundColor ? nodeTextProperties.backgroundColor : '#F2F2F2');
                }

                if (generalProperties.orientation == TreeOrientation.horizontal) {
                    nodeTextGroup.attr('transform', (node: TreePointNode<any>) => {
                        if (node.children) {
                            return Translate(-(svgRect.width + nodeTextProperties.textPadding + nodeTextProperties.spaceBetweenNodeAndText), 0);
                        } else {
                            return Translate(nodeTextProperties.textPadding + nodeTextProperties.spaceBetweenNodeAndText, 0);
                        }
                    });
                } else {
                    nodeTextGroup.attr('transform', (node: TreePointNode<any>) => {
                        let x = svgRect.width / 2;
                        let y = svgRect.height / 2 + nodeTextProperties.textPadding + nodeTextProperties.spaceBetweenNodeAndText;
                        if (node.children) {
                            return Translate(-x, -y);
                        } else {
                            return Translate(-x, y);
                        }
                    });
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

        let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;
        let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeTextProperties;


        nodeTextEnter.selectAll('text')
            .attr('x', adjustXValue)
            .style('text-anchor', (node: TreePointNode<any>) => {
                let textAnchor = node.children ? 'end': 'start';
                return textAnchor;
            })
            .text((node: any) => {
                return node.data.name;
            });

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

        let nodeShapeProperties: TreeNodeShapeProperties = this.treeProperties.nodeShapeProperties;
        let nodeTextProperties: TreeNodeTextProperties = this.treeProperties.nodeTextProperties;

        let textProperties: TextProperties = {
            'fontFamily': nodeTextProperties.fontFamily,
            'fontSize': nodeTextProperties.fontSize
        };
        
        let maxAllowedTextwidth = nodeTextProperties.maxAllowedWidth - (nodeTextProperties.showBackground ? nodeTextProperties.textPadding * 2 : 0);
        nodeTextEnter.selectAll('text')
            .attr('y', (node: TreePointNode<any>) => {
                let totalSpacing = 0;
                let backgroundSpacing = nodeTextProperties.showBackground ? nodeTextProperties.textPadding / 2: 0;
                if (node.children) {
                    totalSpacing = -this.nodeShapeSize - nodeTextProperties.spaceBetweenNodeAndText - backgroundSpacing;
                } else {
                    totalSpacing = this.nodeShapeSize + nodeTextProperties.spaceBetweenNodeAndText * 2 + backgroundSpacing;
                }
                return totalSpacing;
            })
            .style('text-anchor', 'middle')
            .text((node: TreePointNode<any>) => {
                textProperties.text = node.data.name;
                return GetTailoredTextOrDefault(textProperties, maxAllowedTextwidth);
            });

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

        let nodeLinkProperties: TreeNodeLinkProperties = this.treeProperties.nodeLinkProperties;
        let generalProperties: TreeGeneralProperties = this.treeProperties.generalProperties;
        let nodeAnimationDuration: number = this.treeProperties.nodeShapeProperties.animationDuration;

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

        let nodePerpendicularLineLength = this.nodeShapeSize * 2 + generalProperties.extraDepthWiseHeight * 0.3;
        let horizontalCornerLink = (source: TreePointNode<any>, target: TreePointNode<any>) => {
            return "M" + source.x + "," + source.y +
                "H" + (source.x + nodePerpendicularLineLength) +  // TODO: change +15
                "V" + target.y +
                "H" + target.x;
        }
        let verticalCornerLink = (source: TreePointNode<any>, target: TreePointNode<any>) => {
            return "M" + source.x + "," + source.y +
                "V" + (source.y + nodePerpendicularLineLength) +  // TODO: change +15
                "H" + target.x +
                "V" + target.y;
        }

        let createPath = (nodeLink: HierarchyPointLink<any>) => {
            if (nodeLinkProperties.treeNodeLinkType == TreeNodeLinkTypes.curved) {
                if (generalProperties.orientation == TreeOrientation.horizontal) {
                    return horizontalCurveLink(nodeLink as any);
                } else {
                    return verticalCurveLink(nodeLink as any);
                }
            } else if (nodeLinkProperties.treeNodeLinkType == TreeNodeLinkTypes.straight) {
                return straightLink(nodeLink.source, nodeLink.target);
            } else if (nodeLinkProperties.treeNodeLinkType == TreeNodeLinkTypes.corner) {
                if (generalProperties.orientation == TreeOrientation.horizontal) {
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
            .attr('stroke', nodeLinkProperties.stroke)
            .attr('stroke-width', nodeLinkProperties.strokeWidth)
            .attr('d', createPath);

        nodeLinksEnter.append('title')
            .text((nodeLink: HierarchyPointLink<any>) => {
                return nodeLink.source.data.name + " -> " + nodeLink.target.data.name;
            });


        if (nodeLinkProperties.animation) {
            nodeLinksEnter.each((nodeLink: HierarchyPointLink<any>, i: number, elements: Element[]) => {
                let linkLength = (elements[i] as any).getTotalLength();
                select(elements[i])
                    .attr('stroke-dasharray', linkLength + " " + linkLength)
                    .attr("stroke-dashoffset", linkLength)
                    .transition()
                    .delay(nodeAnimationDuration - (nodeAnimationDuration / 3))
                    .duration(nodeLinkProperties.animationDuration)
                    // .ease(d3_ease.easeCubicIn)
                    .attr("stroke-dashoffset", 0);
            });

            nodeLinks.attr('stroke-dasharray', '')
                .attr("stroke-dashoffset", 0)
                .transition()
                .duration(nodeLinkProperties.animationDuration)
                .attr('d', createPath);

            nodeLinks.exit()
                .each((nodeLink: HierarchyPointLink<any>, i: number, elements: Element[]) => {
                    let linkLength = (elements[i] as any).getTotalLength();
                    select(elements[i])
                        .attr('stroke-dasharray', linkLength + " " + linkLength)
                        .attr("stroke-dashoffset", 0)
                        .attr('opacity', 1)
                        .transition()
                        .duration(nodeLinkProperties.animationDuration)
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
