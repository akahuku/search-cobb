# application macros
# ========================================

AWK := gawk
ZIP := zip -qr9
RSYNC := rsync



# basic macros
# ========================================

PRODUCT := SearchCobb
DIST_DIR := .
SRC_DIR := src
EMBRYO_DIR := .embryo
TARGET_SUFFIX := .zip

RSYNC_OPT := -rptLv --delete --exclude-from=embryo-excludes.txt



# derived macros
# ========================================
VERSION := $(shell $(AWK) -e '/"version_name"/{match($$0,/([0-9.]+[^"]*)/,a);print a[0]}' $(SRC_DIR)/manifest.json)

LATEST_SRC_PATH := $(shell \
	find -L $(SRC_DIR) -type f,l \
	-printf '%TY-%Tm-%Td %.8TT %p\n' | sort -nr | head -1 | cut -f3 -d" ")

TARGET_PATH = $(DIST_DIR)/$(PRODUCT)$(TARGET_SUFFIX)



# basic rules
# ========================================

all: zip

zip: $(TARGET_PATH)

clean:
	rm -rf ./$(EMBRYO_DIR)

FORCE:

.PHONY: all zip \
	clean \
	version \
	FORCE

#
# rules
# ========================================
#

# final target
$(TARGET_PATH): $(LATEST_SRC_PATH)
#	ensure working directories exists
	@echo making directories...
	@mkdir -p $(EMBRYO_DIR) $(DIST_DIR)

#	copy all of sources to embryo dir
	@echo synchoronizing source...
	@$(RSYNC) $(RSYNC_OPT) $(SRC_DIR)/ $(EMBRYO_DIR)

#	modify some codes
	@echo updating source code...
	@$(AWK) -e '/###DEBUG CODE START###/,/###DEBUG CODE END###/ {next} 1' \
		$(SRC_DIR)/lib/utils.js \
		> $(EMBRYO_DIR)/lib/utils.js
	@$(AWK) -e '/"version_name"/{print gensub(/([0-9.]+)[^"]*/,"\\1","g");next} 1' \
		$(SRC_DIR)/manifest.json \
		> $(EMBRYO_DIR)/manifest.json

#	build zip archive for google web store
	@echo building zip...
	@rm -f $@
	@cd $(EMBRYO_DIR) \
		&& find . -type f -print0 | sort -z | xargs -0 $(ZIP) $(abspath $@)

	@echo ///
	@echo /// created: $@, version $(VERSION)
	@echo ///

version: FORCE
	@echo version: $(VERSION)
	@echo latest source: $(LATEST_SRC_PATH)

# end
