package com.zufar.bookshelf.dao.country;

import com.zufar.bookshelf.dao.country.model.Country;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CountryRepository extends JpaRepository<Country, Long> {
}
