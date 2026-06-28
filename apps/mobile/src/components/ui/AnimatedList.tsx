import React from "react";
import { FlatList, type FlatListProps } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useMotionEnabled } from "@/hooks/useMotionEnabled";

type Props<T> = Omit<FlatListProps<T>, "renderItem"> & {
  data: T[] | readonly T[] | null | undefined;
  renderItem: (info: { item: T; index: number }) => React.ReactElement | null;
  stagger?: boolean;
  keyExtractor?: (item: T, index: number) => string;
};

export function AnimatedList<T>({ data, renderItem, stagger = true, ...rest }: Props<T>) {
  const motionEnabled = useMotionEnabled();
  const list = (data ?? []) as T[];

  if (!motionEnabled || !stagger) {
    return (
      <FlatList
        data={list}
        renderItem={renderItem as any}
        keyExtractor={rest.keyExtractor as any}
        {...rest}
      />
    );
  }

  return (
    <FlatList
      data={list}
      keyExtractor={rest.keyExtractor as any}
      renderItem={({ item, index }) => (
        <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 50).duration(220)}>
          {renderItem({ item, index })}
        </Animated.View>
      )}
      {...rest}
    />
  );
}
