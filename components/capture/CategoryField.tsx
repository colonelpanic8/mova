import React, { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Chip, Menu, Text, TextInput } from "react-native-paper";

interface CategoryFieldProps {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
  loading?: boolean;
}

export function CategoryField({
  categories,
  value,
  onChange,
  loading = false,
}: CategoryFieldProps) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);

  const filteredCategories = useMemo(() => {
    if (!value.trim()) return categories;
    const lowerValue = value.toLowerCase();
    return categories.filter((cat) => cat.toLowerCase().includes(lowerValue));
  }, [categories, value]);

  const isNewCategory = useMemo(() => {
    if (!value.trim()) return false;
    return !categories.some((cat) => cat.toLowerCase() === value.toLowerCase());
  }, [categories, value]);

  const handleSelectCategory = useCallback(
    (category: string) => {
      onChange(category);
      setMenuVisible(false);
    },
    [onChange],
  );

  const handleInputFocus = useCallback(() => {
    setInputFocused(true);
    setMenuVisible(true);
  }, []);

  const handleInputBlur = useCallback(() => {
    setInputFocused(false);
    // Delay hiding menu to allow click on menu item
    setTimeout(() => {
      if (!inputFocused) {
        setMenuVisible(false);
      }
    }, 200);
  }, [inputFocused]);

  const showMenu =
    menuVisible && (filteredCategories.length > 0 || isNewCategory);

  return (
    <View style={styles.container}>
      <Text variant="bodySmall" style={styles.label}>
        Category *
      </Text>
      <Menu
        visible={showMenu}
        onDismiss={() => setMenuVisible(false)}
        anchor={
          <TextInput
            mode="outlined"
            placeholder={
              loading ? "Loading categories..." : "Select or type category"
            }
            value={value}
            onChangeText={onChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            right={
              <TextInput.Icon
                icon={menuVisible ? "chevron-up" : "chevron-down"}
                onPress={() => setMenuVisible(!menuVisible)}
              />
            }
            disabled={loading}
          />
        }
        anchorPosition="bottom"
        style={styles.menu}
      >
        {filteredCategories.map((category) => (
          <Menu.Item
            key={category}
            onPress={() => handleSelectCategory(category)}
            title={category}
            leadingIcon={
              value.toLowerCase() === category.toLowerCase()
                ? "check"
                : undefined
            }
          />
        ))}
        {isNewCategory && (
          <>
            {filteredCategories.length > 0 && <Menu.Item title="" disabled />}
            <Menu.Item
              onPress={() => handleSelectCategory(value.trim())}
              title={`Create "${value.trim()}"`}
              leadingIcon="plus"
            />
          </>
        )}
      </Menu>
      {value && !loading && (
        <View style={styles.selectedContainer}>
          <Chip
            icon={isNewCategory ? "plus" : "folder"}
            onClose={() => onChange("")}
            style={styles.selectedChip}
          >
            {isNewCategory ? `New: ${value}` : value}
          </Chip>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    opacity: 0.7,
  },
  menu: {
    marginTop: 4,
  },
  selectedContainer: {
    flexDirection: "row",
    marginTop: 8,
  },
  selectedChip: {
    alignSelf: "flex-start",
  },
});
