// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import {
    Animated,
    PanResponder,
    Platform,
    StyleSheet,
    View,
} from 'react-native';

import {DeviceTypes} from 'app/constants';

import SlideUpPanelIndicator from './slide_up_panel_indicator';

const TOP_IOS_MARGIN = DeviceTypes.IS_IPHONE_X ? 84 : 64;
const TOP_ANDROID_MARGIN = 44;
const TOP_MARGIN = Platform.OS === 'ios' ? TOP_IOS_MARGIN : TOP_ANDROID_MARGIN;
const BOTTOM_MARGIN = DeviceTypes.IS_IPHONE_X ? 24 : 0;

export default class SlideUpPanel extends PureComponent {
    static propTypes = {
        containerHeight: PropTypes.number,
        children: PropTypes.oneOfType([
            PropTypes.arrayOf(PropTypes.node),
            PropTypes.node,
        ]).isRequired,
        headerHeight: PropTypes.number,
        initialPosition: PropTypes.number,
        marginFromTop: PropTypes.number,
        onRequestClose: PropTypes.func,
    };

    static defaultProps = {
        headerHeight: 0,
        initialPosition: 0.5,
        marginFromTop: TOP_MARGIN,
        onRequestClose: () => true,
    };

    constructor(props) {
        super(props);

        const initialUsedSpace = Math.abs(props.initialPosition);
        const initialPosition = ((props.containerHeight - (props.headerHeight + BOTTOM_MARGIN)) * (1 - initialUsedSpace));

        this.mainPanGesture = PanResponder.create({
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                return this.isAValidMovement(gestureState.dx, gestureState.dy);
            },
            onPanResponderMove: (evt, gestureState) => {
                this.moveStart(gestureState);
            },
            onPanResponderRelease: (evt, gestureState) => {
                this.moveFinished(gestureState);
            },
        });

        this.secondaryPanGesture = PanResponder.create({
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                return this.isAValidMovement(gestureState.dx, gestureState.dy, true);
            },
            onPanResponderMove: (evt, gestureState) => {
                this.moveStart(gestureState);
            },
            onPanResponderRelease: (evt, gestureState) => {
                this.moveFinished(gestureState);
            },
        });

        this.state = {
            position: new Animated.Value(initialPosition),
            initialPosition,
            finalPosition: props.marginFromTop,
            endPosition: 0,
        };
    }

    handleTouchEnd = () => {
        if (!this.isDragging) {
            this.props.onRequestClose();
        }
    };

    isAValidMovement = (distanceX, distanceY, forceCheck = false) => {
        if (this.state.finalPosition !== this.state.endPosition || forceCheck) {
            const moveTravelledFarEnough = Math.abs(distanceY) > Math.abs(distanceX) && Math.abs(distanceY) > 2;
            return moveTravelledFarEnough;
        }

        return false;
    };

    moveStart = (gestureState) => {
        if (this.viewRef && this.backdrop) {
            const {endPosition, initialPosition} = this.state;
            const isGoingToUp = gestureState.moveY < gestureState.y0;
            let position = gestureState.moveY;

            this.isDragging = true;

            if (isGoingToUp && position > initialPosition) {
                position -= initialPosition;
            } else if (!isGoingToUp && position > endPosition && position > initialPosition && initialPosition !== endPosition) {
                position += endPosition;
            }

            this.backdrop.setNativeProps({pointerEvents: 'none'});
            this.updatePosition(position);
        }
    };

    moveFinished = (gestureState) => {
        if (this.viewRef) {
            let position = gestureState.moveY;
            if (this.previousTop !== position) {
                position = this.previousTop;
            }

            this.startAnimation(gestureState.y0, position);
        }
    };

    setViewRef = (ref) => {
        this.viewRef = ref;
    };

    setBackdropRef = (ref) => {
        this.backdrop = ref;
    };

    startAnimation = (initialY, positionY) => {
        const {containerHeight, onRequestClose} = this.props;
        const {finalPosition, initialPosition} = this.state;
        const isGoingToUp = positionY < initialY;
        const position = new Animated.Value(positionY);
        const currentPosition = Math.abs(positionY / containerHeight);
        let endPosition = (isGoingToUp ? finalPosition : positionY);

        position.removeAllListeners();

        if (!isGoingToUp) {
            if (currentPosition <= this.props.initialPosition) {
                endPosition = initialPosition;
            } else {
                onRequestClose();
                endPosition = containerHeight;
            }
        }

        Animated.timing(position, {
            toValue: endPosition,
            duration: 250,
            useNativeDriver: true,
        }).start(() => {
            if (this.viewRef && this.backdrop) {
                this.setState({endPosition});
                this.backdrop.setNativeProps({pointerEvents: 'box-only'});
                this.isDragging = false;
            }
        });

        position.addListener((pos) => {
            if (this.viewRef) {
                this.updatePosition(pos.value);
            }
        });
    };

    updatePosition = (newPosition) => {
        const {position} = this.state;
        this.previousTop = newPosition;
        position.setValue(newPosition);
    };

    render() {
        const {children} = this.props;
        const containerPosition = {
            top: this.state.position,
        };

        return (
            <View style={styles.viewport}>
                <View
                    ref={this.setBackdropRef}
                    style={styles.backdrop}
                    pointerEvents='box-only'
                    onTouchEnd={this.handleTouchEnd}
                    {...this.secondaryPanGesture.panHandlers}
                />
                <SlideUpPanelIndicator
                    containerPosition={containerPosition}
                    panHandlers={this.secondaryPanGesture.panHandlers}
                />
                <Animated.View
                    ref={this.setViewRef}
                    style={[containerPosition, styles.container]}
                    {...this.mainPanGesture.panHandlers}
                >
                    {children}
                </Animated.View>
            </View>
        );
    }
}

const styles = StyleSheet.create({
    viewport: {
        flex: 1,
    },
    container: {
        flex: 1,
        backgroundColor: 'white',
        ...Platform.select({
            android: {
                borderTopRightRadius: 2,
                borderTopLeftRadius: 2,
            },
            ios: {
                borderTopRightRadius: 10,
                borderTopLeftRadius: 10,
            },
        }),
    },
    backdrop: {
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
    },
});