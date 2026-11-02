/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Button,
  Input,
  Table,
  Image,
  Typography,
  Space,
  message,
  Dropdown,
  Row,
  Col,
  Checkbox,
  Select,
  Modal,
  Spin,
  Alert,
  Descriptions,
  Tag,
  Tabs,
  Tooltip,
} from "antd";
import {
  PlusOutlined,
  ImportOutlined,
  ExportOutlined,
  DeleteOutlined,
  TagOutlined,
  DownOutlined,
  EditOutlined,
  FileOutlined,
  SearchOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { getKiotVietStatus, syncKiotViet } from "../services/kiotviet.service";
import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query"; // Import React Query
import debounce from "lodash.debounce"; // Import debounce function
// Import services
import {
  getProducts,
  deleteProduct,
  getProductById,
} from "../services/products.service"; // Added getProductById
import { getAllBrands, deleteBrand } from "../services/brand.service";
import categoryService from "../services/category.service"; // Import category service
// Import ListX component
import ListX, { ListXItem } from "../components/basicUI/listX";
// Import AddProductModal
import AddProductModal from "../components/products/AddProductModal";
// Import ViewProductModal
// import ViewProductModal from '../components/products/ViewProductModal'
// Import Brand modals
import EditBrandModal from "../components/brands/EditBrandModal";
import AddBrandModal from "../components/brands/AddBrandModal";
// Import Category modals
import EditCategoryModal from "../components/categories/EditCategoryModal";
import AddCategoryModal from "../components/categories/AddCategoryModal";
import { ProductData } from "../interface/product.interface"; // Adjusted import path
import BarcodeModal from "../components/products/BarcodeModal"; // Add this import
import { handleErrorMessage, handleCRUDError, showWarningMessage } from "../utils/errorHandler"; // Import error handlers

const { Text, Title } = Typography;

const kiotvietEnabled = (import.meta.env.VITE_APP_KIOTVIET ?? "false").toString() === "true";

const ProductsPage = () => {
  const queryClient = useQueryClient(); // Initialize the query client
  const [syncingKiotViet, setSyncingKiotViet] = useState(false);
  const { data: kiotvietStatus, refetch: refetchKiotVietStatus } = useQuery({
    queryKey: ["kiotvietStatus"],
    queryFn: getKiotVietStatus,
    enabled: kiotvietEnabled,
    refetchInterval: 60_000,
  });
  const handleSyncKiotViet = async () => {
    setSyncingKiotViet(true);
    try {
      const result = await syncKiotViet();
      message.success(`Đã đồng bộ ${result.count} sản phẩm thay đổi từ KiotViet`);
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      refetchKiotVietStatus();
    } catch (error) {
      handleErrorMessage(error, "Đồng bộ KiotViet thất bại");
    } finally {
      setSyncingKiotViet(false);
    }
  };
  const [productsList, setProductsList] = useState<ProductData[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(true);
  const [productsError, setProductsError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalProducts, setTotalProducts] = useState(0);

  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ListXItem | null>(
    null
  );
  const [selectedBrand, setSelectedBrand] = useState<ListXItem | null>(null);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");

  // Replace isAddModalVisible with more generic product modal state
  const [isProductModalVisible, setIsProductModalVisible] = useState(false);
  const [productModalMode, setProductModalMode] = useState<"add" | "edit">(
    "add"
  );
  const [currentEditingProduct, setCurrentEditingProduct] =
    useState<ProductData | null>(null);

  // Brand state variables
  const [brands, setBrands] = useState<ListXItem[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);
  const [isEditBrandModalVisible, setIsEditBrandModalVisible] = useState(false);
  const [selectedBrandForEdit, setSelectedBrandForEdit] =
    useState<ListXItem | null>(null);
  const [isAddBrandModalVisible, setIsAddBrandModalVisible] = useState(false);

  // Category state variables
  const [categories, setCategories] = useState<ListXItem[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [isEditCategoryModalVisible, setIsEditCategoryModalVisible] =
    useState(false);
  const [selectedCategoryForEdit, setSelectedCategoryForEdit] =
    useState<ListXItem | null>(null);
  const [isAddCategoryModalVisible, setIsAddCategoryModalVisible] =
    useState(false);

  // Add state for expanded row data
  const [expandedRowKeys, setExpandedRowKeys] = useState<React.Key[]>([]);
  const [expandLoading, setExpandLoading] = useState<Record<string, boolean>>(
    {}
  );
  const [expandedProducts, setExpandedProducts] = useState<
    Record<string, ProductData>
  >({});

  // Add this state for the barcode modal
  const [barcodePrintModalVisible, setBarcodePrintModalVisible] =
    useState(false);
  const [selectedProductForBarcode, setSelectedProductForBarcode] =
    useState<ProductData | null>(null);

  // Create a debounced function for search input
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSetSearch = useCallback(
    debounce((text: string) => {
      setDebouncedSearchText(text);
    }, 500), // 500ms debounce time
    []
  );

  // Handle search input change with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchText(value);
    debouncedSetSearch(value);
  };

  // Using React Query to fetch products - updated with proper syntax for v4+
  const {
    data: productsData,
    isLoading: isSearching,
    error: queryError,
  } = useQuery({
    queryKey: [
      "products",
      debouncedSearchText,
      selectedCategory?.id,
      selectedBrand?.id,
      currentPage,
      pageSize,
    ],
    queryFn: async () => {
      const params: Record<string, unknown> = {
        page: currentPage,
        limit: pageSize,
      };

      if (selectedCategory) params.categoryId = selectedCategory.id;
      if (selectedBrand) params.brandId = selectedBrand.id;
      if (debouncedSearchText) params.keyword = debouncedSearchText;

      return await getProducts(params);
    },
    // Replace keepPreviousData with placeholderData using a function that returns previous data
    placeholderData: (previousData) => previousData,
  });

  // Handle query data updates
  useEffect(() => {
    if (productsData) {
      setProductsList(productsData.products);
      setTotalProducts(productsData.total);
      setLoadingProducts(false);
      setProductsError(null);
    }
  }, [productsData]);

  // Handle query errors
  useEffect(() => {
    if (queryError) {
      handleCRUDError.fetch("sản phẩm", queryError);
      setProductsError("Không thể tải danh sách sản phẩm");
      setLoadingProducts(false);
    }
  }, [queryError]);

  useEffect(() => {
    fetchBrands();
    fetchCategories();
  }, []);

  // Fetch brands from API
  const fetchBrands = async () => {
    try {
      setLoadingBrands(true);
      const response = await getAllBrands();
      const brandsData = response.data || [];

      const mappedBrands = brandsData.map(
        (brand: { _id: string; name: string }) => ({
          id: brand._id || "",
          title: brand.name,
        })
      );
      setBrands(mappedBrands);
    } catch (error) {
      handleCRUDError.fetch("thương hiệu", error);
    } finally {
      setLoadingBrands(false);
    }
  };

  // Fetch categories from API
  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const response = await categoryService.getAllCategories();
      const categoriesData = response.data || [];
      const mappedCategories = Array.isArray(categoriesData)
        ? categoriesData.map((category) => ({
          id: category._id || "",
          title: category.name,
        }))
        : [];
      setCategories(mappedCategories);
    } catch (error) {
      handleCRUDError.fetch("danh mục", error);
    } finally {
      setLoadingCategories(false);
    }
  };

  // Handle category selection
  const handleCategorySelect = (item: ListXItem | ListXItem[] | null) => {
    // Ensure we handle different types of selection (array or single item)
    const selectedItem = Array.isArray(item) ? item[0] || null : item;
    setSelectedCategory(selectedItem);

    if (selectedItem) {
      message.info(`Danh mục đã chọn: ${selectedItem.title}`);
    }
  };

  // Handle brand selection
  const handleBrandSelect = (item: ListXItem | ListXItem[] | null) => {
    // Ensure we handle different types of selection (array or single item)
    const selectedItem = Array.isArray(item) ? item[0] || null : item;
    setSelectedBrand(selectedItem);
  };

  // Category actions
  const handleCategoryEdit = (item: ListXItem) => {
    setSelectedCategoryForEdit(item);
    setIsEditCategoryModalVisible(true);
  };

  const handleCategoryUpdateSuccess = () => {
    setIsEditCategoryModalVisible(false);
    setSelectedCategoryForEdit(null);
    // Refresh the categories list
    fetchCategories();
    message.success("Danh mục đã được cập nhật thành công");
  };

  const handleAddCategoryClick = () => {
    setIsAddCategoryModalVisible(true);
  };

  const handleCategoryCreateSuccess = () => {
    setIsAddCategoryModalVisible(false);
    // Refresh the categories list
    fetchCategories();
  };

  const handleCategoryDelete = (item: ListXItem) => {
    Modal.confirm({
      title: "Xác nhận xóa danh mục",
      content: `Bạn có chắc chắn muốn xóa danh mục "${item.title}" không?`,
      okText: "Xóa",
      okType: "danger",
      cancelText: "Hủy",
      onOk: async () => {
        try {
          await categoryService.deleteCategory(String(item.id));
          message.success(`Đã xóa danh mục ${item.title} thành công`);
          // Refresh the categories list after successful deletion
          fetchCategories();
        } catch (error) {
          handleCRUDError.delete("danh mục", error);
        }
      },
    });
  };

  // Brand actions
  const handleBrandEdit = (item: ListXItem) => {
    setSelectedBrandForEdit(item);
    setIsEditBrandModalVisible(true);
  };

  const handleBrandUpdateSuccess = () => {
    setIsEditBrandModalVisible(false);
    setSelectedBrandForEdit(null);
    // Refresh the brands list
    fetchBrands();
  };

  const handleAddBrandClick = () => {
    setIsAddBrandModalVisible(true);
  };

  const handleBrandCreateSuccess = () => {
    setIsAddBrandModalVisible(false);
    // Refresh the brands list
    fetchBrands();
  };

  const handleBrandDelete = (item: ListXItem) => {
    Modal.confirm({
      title: "Xác nhận xóa thương hiệu",
      content: `Bạn có chắc chắn muốn xóa thương hiệu "${item.title}" không?`,
      okText: "Xóa",
      okType: "danger",
      cancelText: "Hủy",
      onOk: async () => {
        try {
          await deleteBrand(String(item.id));
          message.success(`Đã xóa thương hiệu ${item.title} thành công`);
          // Refresh the brands list after successful deletion
          fetchBrands();
        } catch (error) {
          handleCRUDError.delete("thương hiệu", error);
        }
      },
    });
  };

  // Update this function to invalidate the query cache instead
  const refreshProductsList = () => {
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  // Handle delete selected products
  const handleDeleteSelected = async () => {
    if (selectedRowKeys.length === 0) {
      showWarningMessage("Vui lòng chọn sản phẩm để xóa");
      return;
    }
    Modal.confirm({
      title: `Xác nhận xóa ${selectedRowKeys.length} sản phẩm`,
      content:
        "Bạn có chắc chắn muốn xóa các sản phẩm đã chọn không? Hành động này không thể hoàn tác.",
      okText: "Xóa",
      okType: "danger",
      cancelText: "Hủy",
      onOk: async () => {
        try {
          await Promise.all(
            selectedRowKeys.map((key) => deleteProduct(String(key)))
          );
          message.success(
            `Đã xóa ${selectedRowKeys.length} sản phẩm thành công!`
          );
          setSelectedRowKeys([]);
          refreshProductsList(); // Refresh using React Query
        } catch (error) {
          handleCRUDError.delete("sản phẩm", error);
        }
      },
    });
  };
  // Add modal handlers
  const openAddProductModal = () => {
    setProductModalMode("add");
    setCurrentEditingProduct(null);
    setIsProductModalVisible(true);
  };

  const openEditProductModal = (product: ProductData) => {
    setProductModalMode("edit");
    setCurrentEditingProduct(product);
    setIsProductModalVisible(true);
  };

  const handleProductModalCancel = () => {
    setIsProductModalVisible(false);
    setCurrentEditingProduct(null);
  };

  const handleProductModalSubmit = () => {
    setIsProductModalVisible(false);
    setCurrentEditingProduct(null);
    refreshProductsList();

    if (
      currentEditingProduct?._id &&
      expandedRowKeys.includes(currentEditingProduct._id)
    ) {
      handleExpand(
        true,
        productsList.find((p) => p._id === currentEditingProduct._id)
      );
    }
  };

  const handleExpand = async (
    expanded: boolean,
    record: ProductData | undefined
  ) => {
    if (!record) {
      return; // Or handle the undefined case as needed
    }
    const recordKey = String(record._id);

    if (expanded) {
      // Add the record to expanded keys
      setExpandedRowKeys([recordKey]);

      // If we already have detailed data, don't fetch again
      if (expandedProducts[recordKey]) {
        return;
      }

      // Start loading
      setExpandLoading((prev) => ({ ...prev, [recordKey]: true }));

      try {
        // Fetch detailed product data
        const response = (await getProductById(record._id)) as {
          ok: boolean;
          data: ProductData | null;
          message?: string;
        };
        if (response.ok && response.data) {
          // Store the detailed product data
          setExpandedProducts((prev) => ({
            ...prev,
            [recordKey]: response.data!, // Assert non-null as per the conditional check
          }));
        } else {
          handleErrorMessage(null, "Không thể tải chi tiết sản phẩm");
        }
      } catch (error) {
        handleCRUDError.fetch("chi tiết sản phẩm", error);
      } finally {
        // End loading
        setExpandLoading((prev) => ({ ...prev, [recordKey]: false }));
      }
    } else {
      // Remove the record from expanded keys
      setExpandedRowKeys([]);
    }
  };

  // Render expanded content for a product row
  const renderExpandedRow = (record: ProductData | undefined) => {
    if (!record) {
      return (
        <Alert
          message="Không có dữ liệu sản phẩm để hiển thị chi tiết."
          type="warning"
        />
      );
    }
    const recordKey = String(record._id);
    const isLoading = expandLoading[recordKey];
    const detailedProduct = expandedProducts[recordKey];

    if (isLoading) {
      return <Spin tip="Cargando detalles..." />;
    }

    if (!detailedProduct) {
      return (
        <Alert
          message="No se pudieron cargar los detalles del producto"
          type="warning"
        />
      );
    }

    // Format currency
    const formatCurrency = (amount?: number) => {
      if (amount === undefined) return "N/A";
      return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
      }).format(amount);
    };

    return (
      <div style={{ padding: "16px", backgroundColor: "#f9f9f9" }}>
        <Tabs defaultActiveKey="info">
          <Tabs.TabPane tab="Thông tin" key="info">
            <Row gutter={[16, 16]}>
              <Col span={6}>
                {detailedProduct.mainImage ? (
                  <>
                    <div
                      style={{
                        width: "100%",
                        height: "200px",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        backgroundColor: "#f8f8f8",
                        borderRadius: "4px",
                        overflow: "hidden",
                      }}
                    >
                      <Image
                        src={detailedProduct.mainImage}
                        alt={detailedProduct.name}
                        style={{
                          maxWidth: "100%",
                          maxHeight: "200px",
                          objectFit: "contain",
                        }}
                        fallback="https://phutungnhapkhauchinhhang.com/wp-content/uploads/2020/06/default-thumbnail.jpg"
                      />
                    </div>

                    {/* Thumbnail images from listImage */}
                    {detailedProduct.listImage &&
                      detailedProduct.listImage.length > 1 && (
                        <div
                          style={{
                            marginTop: "10px",
                            width: "100%",
                            overflow: "auto",
                            scrollbarWidth: "thin",
                            position: "relative",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              paddingBottom: "5px",
                              width:
                                detailedProduct.listImage.length > 4
                                  ? "max-content"
                                  : "100%",
                              justifyContent:
                                detailedProduct.listImage.length <= 4
                                  ? "center"
                                  : "flex-start",
                            }}
                          >
                            {detailedProduct.listImage.map((image, index) => (
                              <div key={index} style={{ flex: "0 0 auto" }}>
                                <Image
                                  src={image}
                                  alt={`${detailedProduct.name} - ${index + 1}`}
                                  style={{
                                    width: "50px",
                                    height: "50px",
                                    objectFit: "cover",
                                    cursor: "pointer",
                                    border:
                                      image === detailedProduct.mainImage
                                        ? "2px solid #1890ff"
                                        : "1px solid #f0f0f0",
                                    borderRadius: "4px",
                                  }}
                                  preview={{
                                    src: image,
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                          {detailedProduct.listImage.length > 4 && (
                            <div
                              style={{
                                position: "absolute",
                                bottom: "0",
                                right: "0",
                                background:
                                  "linear-gradient(to right, transparent, white 70%)",
                                width: "30px",
                                height: "100%",
                                pointerEvents: "none",
                              }}
                            />
                          )}
                        </div>
                      )}
                  </>
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "200px",
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      backgroundColor: "#f8f8f8",
                      borderRadius: "4px",
                      overflow: "hidden",
                    }}
                  >
                    <Image
                      src="https://phutungnhapkhauchinhhang.com/wp-content/uploads/2020/06/default-thumbnail.jpg"
                      alt={detailedProduct.name}
                      style={{
                        maxWidth: "100%",
                        maxHeight: "200px",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                )}
              </Col>
              <Col span={18}>
                <Space
                  direction="vertical"
                  style={{ width: "100%" }}
                  size="middle"
                >
                  <div>
                    <Title level={4}>{detailedProduct.name}</Title>
                    <Space>
                      {detailedProduct.isVariable && (
                        <Tag color="blue">Sản phẩm biến thể</Tag>
                      )}
                      {detailedProduct.isSerial && (
                        <Tag color="green">Quản lý Serial</Tag>
                      )}
                    </Space>
                  </div>
                  <Descriptions
                    bordered
                    size="small"
                    column={{ xxl: 2, xl: 2, lg: 1, md: 1, sm: 1, xs: 1 }}
                  >
                    <Descriptions.Item label="Serial">
                      {detailedProduct.barcode || "N/A"}
                    </Descriptions.Item>
                    <Descriptions.Item label="Giá vốn">
                      {formatCurrency(detailedProduct.costPrice)}
                    </Descriptions.Item>
                    <Descriptions.Item label="Tồn kho">
                      {detailedProduct.stock || 0}
                      {detailedProduct.inventories?.map((inv) => (
                        <div key={inv.branchId}>
                          <Text type="secondary">
                            {inv.branchName}: {inv.onHand}
                            {inv.reserved ? ` (đặt ${inv.reserved})` : ""}
                          </Text>
                        </div>
                      ))}
                    </Descriptions.Item>
                    <Descriptions.Item label="Giá bán">
                      {formatCurrency(detailedProduct.sellPrice)}
                    </Descriptions.Item>
                  </Descriptions>
                </Space>
              </Col>
            </Row>
          </Tabs.TabPane>

          <Tabs.TabPane tab="Mô tả" key="desc">
            {detailedProduct.description ? (
              <div
                dangerouslySetInnerHTML={{
                  __html: detailedProduct.description,
                }}
              />
            ) : (
              <Alert message="Không có mô tả cho sản phẩm này." type="info" />
            )}
          </Tabs.TabPane>

          <Tabs.TabPane tab="Biến thể" key="variants">
            {detailedProduct.isVariable &&
              detailedProduct.variables &&
              detailedProduct.variables.length > 0 ? (
              <Table
                dataSource={detailedProduct.variables}
                rowKey={(variant) => String(variant._id)}
                size="small"
                pagination={false}
                columns={[
                  {
                    title: "Thuộc tính",
                    key: "attributes",
                    render: (_, variant) =>
                      variant.attribute
                        .map((attr) => `${attr.key}: ${attr.value}`)
                        .join(", "),
                  },
                  {
                    title: "Hình ảnh",
                    key: "image",
                    width: 80,
                    render: (_, variant) => (
                      <Image
                        src={
                          variant.mainImage ||
                          "https://phutungnhapkhauchinhhang.com/wp-content/uploads/2020/06/default-thumbnail.jpg"
                        }
                        alt="Variant"
                        width={40}
                        height={40}
                        style={{ objectFit: "cover" }}
                      />
                    ),
                  },
                  {
                    title: "Giá vốn",
                    dataIndex: "costPrice",
                    render: (price) => formatCurrency(price),
                  },
                  {
                    title: "Giá bán",
                    dataIndex: "sellPrice",
                    render: (price) => formatCurrency(price),
                  },
                  {
                    title: "Tồn kho",
                    dataIndex: "stock",
                    render: (stock) => stock || 0,
                  },
                  {
                    title: "Serial",
                    key: "serials",
                    render: (_, variant) => {
                      if (
                        variant.isSerial &&
                        variant.serials &&
                        variant.serials.length > 0
                      ) {
                        // Create menu items for serials
                        const serialItems = variant.serials.map(
                          (serial, index) => ({
                            key: index.toString(),
                            label: serial,
                          })
                        );

                        return (
                          <Dropdown
                            menu={{ items: serialItems }}
                            trigger={["click"]}
                          >
                            <Button type="link">
                              {variant.serials.length} serial(s)
                            </Button>
                          </Dropdown>
                        );
                      }
                      return "Không có";
                    },
                  },
                ]}
              />
            ) : (
              <Alert
                message="Sản phẩm này không có biến thể hoặc không được quản lý dưới dạng biến thể."
                type="info"
              />
            )}
          </Tabs.TabPane>

          <Tabs.TabPane tab="Serial" key="serial">
            {detailedProduct.isSerial &&
              detailedProduct.serials &&
              detailedProduct.serials.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {detailedProduct.serials.map((serial, index) => (
                  <Tag key={index}>{serial}</Tag>
                ))}
              </div>
            ) : (
              <Alert
                message="Sản phẩm này không quản lý serial hoặc chưa có serial nào được nhập."
                type="info"
              />
            )}
          </Tabs.TabPane>
        </Tabs>
        <Space
          style={{
            marginTop: "16px",
            justifyContent: "flex-end",
            width: "100%",
          }}
        >
          <Button
            icon={<EditOutlined />}
            onClick={() => {
              if (detailedProduct) {
                openEditProductModal(detailedProduct);
              } else {
                handleErrorMessage(null, "Không thể tải dữ liệu sản phẩm để sửa");
              }
            }}
          >
            Sửa sản phẩm
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: "Xác nhận xóa sản phẩm",
                content: `Bạn có chắc chắn muốn xóa sản phẩm "${detailedProduct.name}" không?`,
                okText: "Xóa",
                okType: "danger",
                cancelText: "Hủy",
                onOk: async () => {
                  try {
                    await deleteProduct(String(detailedProduct._id));
                    message.success(
                      `Đã xóa sản phẩm ${detailedProduct.name} thành công`
                    );
                    refreshProductsList(); // Refresh the list
                    setExpandedRowKeys([]); // Close the expanded row
                  } catch (error) {
                    handleCRUDError.delete("sản phẩm", error);
                  }
                },
              });
            }}
          >
            Xóa sản phẩm
          </Button>
          <Button
            type="primary"
            icon={<TagOutlined />}
            onClick={() => {
              setSelectedProductForBarcode(detailedProduct);
              setBarcodePrintModalVisible(true);
            }}
          >
            In tem sản phẩm
          </Button>
        </Space>
      </div>
    );
  };

  // Row selection configuration
  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => {
      setSelectedRowKeys(keys);
    },
  };

  // Define table columns
  const columns = [
    {
      title: "Mã SP",
      dataIndex: "barcode", // This will use ProductData.productId
      key: "barcode",
      width: 120,
      sorter: (a: ProductData, b: ProductData) =>
        (a.barcode || a._id.toString()).localeCompare(
          b.barcode || b._id.toString()
        ),
      render: (text: string | undefined, record: ProductData) =>
        text || record._id?.toString() || "N/A",
    },
    {
      title: "Hình ảnh",
      dataIndex: "mainImage",
      key: "mainImage",
      width: 100,
      render: (_: any, record?: ProductData) => (
        <Image
          src={
            record?.mainImage ||
            "https://phutungnhapkhauchinhhang.com/wp-content/uploads/2020/06/default-thumbnail.jpg"
          } // Fallback image
          alt={record?.name}
          fallback="https://phutungnhapkhauchinhhang.com/wp-content/uploads/2020/06/default-thumbnail.jpg"
          width={50}
          height={50}
          style={{ objectFit: "cover" }}
        />
      ),
    },
    {
      title: "Tên sản phẩm",
      dataIndex: "name",
      key: "name",
      width: 300,
      sorter: (a: ProductData, b: ProductData) =>
        (a.name || "").localeCompare(b.name || ""),
      render: (text: string | undefined) => text || "Không có tên", // Fallback for name
    },

    {
      title: "Giá vốn",
      dataIndex: "costPrice",
      key: "costPrice",
      width: 150,
      render: (price?: number) =>
        price?.toLocaleString("vi-VN", {
          style: "currency",
          currency: "VND",
        }) || "N/A",
      sorter: (a: ProductData, b: ProductData) =>
        (a.costPrice || 0) - (b.costPrice || 0),
    },
    {
      title: "Giá bán",
      dataIndex: "sellPrice",
      key: "sellPrice",
      width: 150,
      render: (price?: number) =>
        price?.toLocaleString("vi-VN", {
          style: "currency",
          currency: "VND",
        }) || "N/A",
      sorter: (a: ProductData, b: ProductData) =>
        (a.sellPrice || 0) - (b.sellPrice || 0),
    },
    {
      title: "Tồn kho",
      dataIndex: "stock",
      key: "stock",
      width: 100,
      render: (stock?: number) => stock || 0,
      sorter: (a: ProductData, b: ProductData) =>
        (a.stock || 0) - (b.stock || 0),
    },
    // {
    //     title: 'Loại',
    //     dataIndex: 'isVariable',
    //     key: 'isVariable',
    //     width: 120,
    //     render: (isVariable?: boolean) => (
    //         isVariable ? <Tag color="blue">Có biến thể</Tag> : <Tag color="green">Đơn giản</Tag>
    //     ),
    //     filters: [
    //         { text: 'Có biến thể', value: true },
    //         { text: 'Đơn giản', value: false },
    //     ],
    //     onFilter: (value: boolean | React.Key, record: ProductData) => record.isVariable === value,
    // },
    // {
    //     title: 'Serial',
    //     dataIndex: 'isSerial', // This refers to product-level serial
    //     key: 'isSerialProduct',
    //     width: 150,
    //     render: (isSerial?: boolean, record?: ProductData) => {
    //         if (record?.isVariable) {
    //             const anyVariantSerial = record.variablesProduct?.some(vp => vp.isSerial === true);
    //             return anyVariantSerial ? <Tag color="purple">QL Serial (Biến thể)</Tag> : <Tag color="default">Không QL Serial</Tag>;
    //         }
    //         return isSerial ? <Tag color="cyan">QL Serial (SP)</Tag> : <Tag color="default">Không QL Serial</Tag>;
    //     },
    // },
    // {
    //     title: 'Thao Tác',
    //     key: 'action',
    //     width: 180,
    //     fixed: 'right' as const,
    //     render: (_: unknown, record: ProductData) => (
    //         <Space size="small">
    //             <Button icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); /* handleEdit(record.id || record.productId) */ message.info("Chức năng sửa chưa hoàn thiện"); }}>Sửa</Button>
    //             <Button icon={<DeleteOutlined />} danger onClick={(e) => { e.stopPropagation(); handleDeleteSingleProduct(record._id || record.productId || '') }}>Xóa</Button>
    //         </Space>
    //     ),
    // },
  ];

  // Create dropdown menu items
  const actionMenuItems = [
    {
      key: "delete",
      icon: <DeleteOutlined />,
      label: "Xóa đã chọn",
      onClick: handleDeleteSelected,
    },
    {
      key: "export",
      icon: <FileOutlined />,
      label: "Xuất File",
      onClick: () => {
        message.info(`Đã chọn xuất ${selectedRowKeys.length} sản phẩm`);
      },
    },
    {
      key: "print-tags",
      icon: <TagOutlined />,
      label: "Mã In Tem",
      onClick: () => {
        message.info(`Đã chọn in tem cho ${selectedRowKeys.length} sản phẩm`);
      },
    },
  ];

  return (
    <>
      <div className="isDesktop">
        <Col span={2}> </Col>
        <Col className="products-page ">
          <Col span={4} className="products-page__left">
            <div className="products-page__left__title ">Hàng Hóa</div>
            <div className="products-page__left__listX">
              <div className="products-page__left__listX__categories notMobile">
                <ListX
                  title="Danh mục sản phẩm"
                  isSearch={true}
                  textSearch=""
                  isCheckbox={true}
                  value={categories}
                  onItemSelect={handleCategorySelect}
                  emptyText="Không có danh mục nào"
                  className="categories-list"
                  isHierarchical={true}
                  indentSize={16}
                  isAdd={true}
                  isCollapsible={true}
                  loading={loadingCategories}
                  isEdit={true}
                  onEditClick={handleCategoryEdit}
                  isDelete={true}
                  onDeleteClick={handleCategoryDelete}
                  onAddClick={handleAddCategoryClick}
                />
              </div>
              <div className="products-page__left__listX__brands notMobile">
                <ListX
                  title="Thương hiệu"
                  isSearch={true}
                  textSearch=""
                  isCheckbox={true}
                  value={brands}
                  onItemSelect={handleBrandSelect}
                  emptyText="Không có thương hiệu nào"
                  className="brands-list"
                  isHierarchical={true}
                  indentSize={16}
                  isCollapsible={true}
                  loading={loadingBrands}
                  isAdd={true}
                  onAddClick={handleAddBrandClick}
                  isEdit={true}
                  onEditClick={handleBrandEdit}
                  isDelete={true}
                  onDeleteClick={handleBrandDelete}
                />
              </div>
            </div>
          </Col>
          <Col span={20} className="products-page__right">
            <div className="products-page__right__top-row">
              <div className="products-page__right__search">
                <Input.Search
                  placeholder="Tìm kiếm hàng hóa..."
                  style={{ width: 300 }}
                  allowClear
                  value={searchText}
                  onChange={handleSearchChange}
                  onSearch={setDebouncedSearchText} // Direct call to set debounced text
                  loading={isSearching}
                  prefix={<SearchOutlined />}
                />
              </div>
              <div className="products-page__right__button">
                {selectedRowKeys.length > 0 ? (
                  <Space>
                    <Text strong>
                      {selectedRowKeys.length} sản phẩm đã chọn
                    </Text>
                    <Dropdown
                      menu={{ items: actionMenuItems }}
                      trigger={["hover"]}
                    >
                      <Button type="primary">
                        Thao Tác <DownOutlined />
                      </Button>
                    </Dropdown>
                  </Space>
                ) : (
                  <>
                    {kiotvietEnabled && (
                      <Tooltip
                        title={
                          kiotvietStatus?.lastSyncAt
                            ? `${kiotvietStatus.productCount} sản phẩm, đồng bộ lúc ${new Date(kiotvietStatus.lastSyncAt).toLocaleString("vi-VN")}`
                            : "Chưa đồng bộ"
                        }
                      >
                        <Button
                          icon={<SyncOutlined spin={syncingKiotViet} />}
                          loading={syncingKiotViet}
                          onClick={handleSyncKiotViet}
                          style={{ marginRight: 8 }}
                        >
                          Đồng bộ KiotViet
                        </Button>
                      </Tooltip>
                    )}
                    <Button
                      type="primary"
                      icon={<PlusOutlined />}
                      onClick={openAddProductModal} // Updated from showAddModal
                    >
                      Thêm Hàng Hóa
                    </Button>
                    <Button
                      type="primary"
                      style={{ marginLeft: 8 }}
                      icon={<ImportOutlined />}
                    >
                      Import
                    </Button>
                    <Button
                      type="primary"
                      style={{ marginLeft: 8 }}
                      icon={<ExportOutlined />}
                    >
                      Xuất File
                    </Button>
                  </>
                )}
              </div>
            </div>
            <div className="products-page__right__table">
              {(loadingProducts || isSearching) && (
                <Spin
                  tip="Đang tải danh sách sản phẩm..."
                  style={{ display: "block", marginTop: 20 }}
                />
              )}
              {productsError && !loadingProducts && !isSearching && (
                <Alert
                  message="Lỗi"
                  description={productsError}
                  type="error"
                  showIcon
                  closable
                  onClose={() => setProductsError(null)}
                  style={{ margin: "20px 0" }}
                />
              )}
              {!loadingProducts && !productsError && (
                <Table
                  rowSelection={rowSelection}
                  columns={columns}
                  dataSource={productsList}
                  rowKey={(record) => record._id || String(Math.random())} // Use id from API (mapped from _id)
                  pagination={{
                    current: currentPage,
                    pageSize: pageSize,
                    total: totalProducts,
                    onChange: (page, newPageSize) => {
                      setCurrentPage(page);
                      if (newPageSize) setPageSize(newPageSize);
                    },
                    showSizeChanger: true,
                    pageSizeOptions: ["10", "20", "50", "100"],
                    showTotal: (total, range) =>
                      `${range[0]}-${range[1]} of ${total} items`,
                  }}
                  expandable={{
                    expandedRowRender: renderExpandedRow,
                    onExpand: handleExpand,
                    expandedRowKeys: expandedRowKeys,
                    expandRowByClick: true,
                  }}
                  // scroll={{ y: 5000, x: 'max-content' }}
                  bordered={false}
                  className="custom-table"
                  rowClassName={(_, index) =>
                    index % 2 === 0 ? "table-row-light" : "table-row-dark"
                  }
                />
              )}
            </div>
          </Col>
        </Col>
        <Col span={2}> </Col>
      </div>
      <div className="isMobile">
        <Col className="isMobile-products-page-top ">
          <Row className="isMobile-products-page-top-row">
            <div className="isMobile-products-page-title">Hàng Hóa</div>
            <div className="isMobile-products-page-search">
              <Input.Search
                placeholder="Tìm kiếm hàng hóa..."
                allowClear
                value={searchText}
                onChange={handleSearchChange}
                onSearch={setDebouncedSearchText} // Direct call to set debounced text
                className="isMobile-products-page-search-input"
                loading={isSearching}
                prefix={<SearchOutlined />}
              />
            </div>
          </Row>
          <Row className="isMobile-products-page-filter-container">
            <div>
              <Dropdown
                menu={{
                  items: [
                    { key: "desc", label: "Mới nhất" },
                    { key: "asc", label: "Cũ nhất" },
                    { key: "none", label: "Không lọc" },
                  ],
                }}
              >
                <Select
                  labelInValue
                  defaultValue={{ value: "thoigian", label: "Thời Gian" }}
                  style={{ width: 120 }}
                  options={[
                    { value: "moinhat", label: "Mới nhất" },
                    { value: "cunhat", label: "Cũ nhất" },
                    { value: "khongloc", label: "Không lọc" },
                  ]}
                />
              </Dropdown>
            </div>
            <div>
              <Dropdown
                menu={{
                  items: [
                    { key: "desc", label: "Cao-Thấp" },
                    { key: "asc", label: "Thấp-Cao" },
                    { key: "none", label: "Không lọc" },
                  ],
                }}
              >
                <Select
                  defaultValue={{ value: "giaban", label: "Giá Bán" }}
                  options={[
                    { value: "caotdenhap", label: "Cao-Thấp" },
                    { value: "thapdencao", label: "Thấp-Cao" },
                    { value: "khongloc", label: "Không lọc" },
                  ]}
                />
              </Dropdown>
            </div>
            <div>
              <Checkbox>Còn hàng</Checkbox>
            </div>
          </Row>
          <Row>
            <Col className="isMobile-products-page-inventory">
              <div className="isMobile-products-page-inventory-title">
                Hàng Tồn
              </div>
              <div className="isMobile-products-page-inventory-value">
                5,900 Hàng Hóa
              </div>
            </Col>
            <Col className="isMobile-products-page-add-button">
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={openAddProductModal}
                style={{ width: "100%" }}
              >
                Thêm Hàng Hóa
              </Button>
            </Col>
          </Row>
        </Col>

        <Col className="isMobile-products-page-table">
          {loadingProducts && <Spin tip="Đang tải..." />}
          {productsError && !loadingProducts && (
            <Alert message={productsError} type="error" showIcon />
          )}
          {!loadingProducts && !productsError && (
            <Table
              rowSelection={rowSelection}
              dataSource={productsList} // Use fetched productsList
              rowKey={(record) =>
                record
                  ? record._id || record.productId || String(Math.random())
                  : String(Math.random())
              }
              pagination={{ pageSize: 100 }} // Consider smaller for mobile
              expandable={{
                expandedRowRender: renderExpandedRow,
                onExpand: handleExpand,
                expandedRowKeys: expandedRowKeys,
                expandRowByClick: true,
              }}
              bordered={false}
              className="custom-table-mobile"
              columns={[
                {
                  title: "",
                  dataIndex: "mainImage", // Use mainImage from ProductData
                  key: "imageUrl",
                  width: "25%",
                  render: (mainImage?: string, record?: ProductData) => (
                    <Image
                      src={
                        mainImage ||
                        record?.listImage?.[0] ||
                        "https://via.placeholder.com/60"
                      }
                      alt={record?.name}
                      fallback="https://phutungnhapkhauchinhhang.com/wp-content/uploads/2020/06/default-thumbnail.jpg"
                      width={60}
                      height={60}
                      style={{ objectFit: "cover" }}
                    />
                  ),
                },
                {
                  title: "",
                  key: "productInfo",
                  width: "45%",
                  render: (
                    record: ProductData // Use ProductData
                  ) => (
                    <Space direction="vertical" size={0}>
                      <Text strong style={{ fontSize: "14px" }}>
                        {record.name}
                      </Text>
                      <Text type="secondary" style={{ fontSize: "12px" }}>
                        Mã: {record.productId}
                      </Text>
                    </Space>
                  ),
                },
                {
                  title: () => (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        width: "100%",
                      }}
                    >
                      <Button
                        type="text"
                        icon={<DeleteOutlined />}
                        disabled={selectedRowKeys.length === 0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSelected();
                        }}
                        style={{
                          color:
                            selectedRowKeys.length > 0 ? "#ff4d4f" : "#d9d9d9",
                        }}
                      />
                    </div>
                  ),
                  key: "priceInfo",
                  width: "30%",
                  render: (
                    record: ProductData // Use ProductData
                  ) => (
                    <Space direction="vertical" size={0} align="end">
                      {record.sellPrice?.toLocaleString("vi-VN", {
                        style: "currency",
                        currency: "VND",
                      }) || "N/A"}
                      <Text type="secondary" style={{ fontSize: "12px" }}>
                        Tồn: {record.stock || 0}
                      </Text>
                    </Space>
                  ),
                },
              ]}
              size="small"
              rowClassName={(_, index) =>
                index % 2 === 0 ? "table-row-light" : "table-row-dark"
              }
            />
          )}
        </Col>
      </div>

      {/* Keep only ONE instance of ViewProductModal for both mobile and desktop */}
      <AddProductModal
        visible={isProductModalVisible}
        mode={productModalMode}
        initialProductData={currentEditingProduct || undefined}
        onCancel={handleProductModalCancel}
        onSubmit={handleProductModalSubmit}
        categories={categories}
        brands={brands.map((brand) => ({ id: brand.id, name: brand.title }))}
      />
      {/* Add EditBrandModal component */}
      <EditBrandModal
        visible={isEditBrandModalVisible}
        brand={
          selectedBrandForEdit
            ? {
              id: String(selectedBrandForEdit.id),
              title: selectedBrandForEdit.title,
            }
            : null
        }
        onCancel={() => setIsEditBrandModalVisible(false)}
        onSuccess={handleBrandUpdateSuccess}
      />
      <AddBrandModal
        visible={isAddBrandModalVisible}
        onCancel={() => setIsAddBrandModalVisible(false)}
        onSuccess={handleBrandCreateSuccess}
      />
      {/* Add Category modals */}
      <EditCategoryModal
        visible={isEditCategoryModalVisible}
        category={
          selectedCategoryForEdit
            ? {
              id: String(selectedCategoryForEdit.id),
              title: selectedCategoryForEdit.title,
            }
            : null
        }
        onCancel={() => setIsEditCategoryModalVisible(false)}
        onSuccess={handleCategoryUpdateSuccess}
      />
      <AddCategoryModal
        visible={isAddCategoryModalVisible}
        onCancel={() => setIsAddCategoryModalVisible(false)}
        onSuccess={handleCategoryCreateSuccess}
      />
      {/* Add the Barcode Modal */}
      <BarcodeModal
        visible={barcodePrintModalVisible}
        onClose={() => setBarcodePrintModalVisible(false)}
        productData={
          selectedProductForBarcode
            ? {
              ...selectedProductForBarcode,
              _id: String(selectedProductForBarcode._id),
            }
            : {}
        }
        copies={1} // Default to 1 copy, you could add a selector for this
      />
    </>
  );
};

export default ProductsPage;
